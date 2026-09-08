/*
 * dht11.c
 *
 * Voir dht11.h pour la documentation d'interface et le cablage.
 *
 * Principe :
 *  - PIN driver pour basculer dynamiquement DIO24 entre sortie (start signal)
 *    et entree avec pull-up (lecture reponse + bits).
 *  - Timer GPT0 configure en mode periodique 32 bits, comptage croissant,
 *    horloge a 48 MHz (confirme documentation/forum TI pour CC13x0). On lit
 *    sa valeur en continu (polling, pas d'interruption) pour mesurer la
 *    duree des impulsions du protocole DHT11.
 *
 * CORRECTION (par rapport a la version precedente) :
 *  Le GPT0 est maintenant active a la fois en mode RUN, SLEEP et DEEP SLEEP
 *  (PRCMPeripheralRunEnable + SleepEnable + DeepSleepEnable). Sans les deux
 *  derniers, TI-RTOS met le CPU en veille (standby) pendant chaque
 *  Task_sleep() entre deux lectures, ce qui pouvait couper l'horloge du GPT0
 *  et corrompre la mesure des durees d'impulsion des le deuxieme cycle.
 */

#include <stddef.h>
#include <ti/drivers/PIN.h>
#include <ti/drivers/pin/PINCC26XX.h>
#include <ti/devices/cc13x0/driverlib/timer.h>
#include <ti/devices/cc13x0/driverlib/prcm.h>
#include <ti/devices/cc13x0/inc/hw_memmap.h>
#include "dht11.h"

/* Horloge GPTimer = 48 MHz sur CC13x0 -> 48 ticks = 1 microseconde */
#define TICKS_PER_US            48UL
#define US_TO_TICKS(us)         ((uint32_t)(us) * TICKS_PER_US)

#define DHT11_START_LOW_US      18000U   /* signal de start : 18-20 ms */
#define DHT11_RELEASE_US        30U      /* relachement de la ligne avant lecture */
#define DHT11_RESPONSE_TIMEOUT  150U     /* attente reponse capteur (us) */
#define DHT11_BIT_TIMEOUT       150U     /* attente transition de bit (us) */
#define DHT11_BIT_THRESHOLD_US  40U      /* haut > 40us => bit '1', sinon '0' */

static PIN_Handle dhtPinHandle = NULL;
static PIN_State  dhtPinState;
static PIN_Config dhtPinTable[2];
static PIN_Id     dhtIoid;

static bool dhtTimerReady = false;

/* ---- Utilitaires de timing bases sur le GPT0 (32 bits, up-counting) ---- */

static inline uint32_t ticks(void)
{
    return TimerValueGet(GPT0_BASE, TIMER_A);
}

/* Arithmetique non signee : reste correcte meme en cas de depassement (wrap) */
static inline uint32_t elapsedTicks(uint32_t start)
{
    return ticks() - start;
}

static void delayUs(uint32_t us)
{
    uint32_t start = ticks();
    uint32_t targetTicks = US_TO_TICKS(us);
    while (elapsedTicks(start) < targetTicks) {
        /* attente active */
    }
}

/* Attend que la broche atteigne le niveau demande, avec timeout.
 * Retourne false si le timeout est atteint avant la transition. */
static bool waitForLevel(uint8_t level, uint32_t timeoutUs)
{
    uint32_t start = ticks();
    uint32_t timeoutTicks = US_TO_TICKS(timeoutUs);
    while (PIN_getInputValue(dhtIoid) != level) {
        if (elapsedTicks(start) > timeoutTicks) {
            return false;
        }
    }
    return true;
}

/* ---- Bascule de direction de la broche (one-wire) ---- */

static void pinDriveLow(void)
{
    PIN_setOutputValue(dhtPinHandle, dhtIoid, 0);
    PIN_setConfig(dhtPinHandle, PIN_BM_GPIO_OUTPUT_EN, dhtIoid | PIN_GPIO_OUTPUT_EN);
}

static void pinReleaseAsInput(void)
{
    PIN_setConfig(dhtPinHandle, PIN_BM_GPIO_OUTPUT_EN, dhtIoid | PIN_GPIO_OUTPUT_DIS);
}

/* ------------------------------------------------------------------ */

bool DHT11_init(PIN_Id ioid)
{
    dhtIoid = ioid;

    dhtPinTable[0] = ioid | PIN_INPUT_EN | PIN_PULLUP | PIN_GPIO_OUTPUT_DIS | PIN_DRVSTR_MAX;
    dhtPinTable[1] = PIN_TERMINATE;

    dhtPinHandle = PIN_open(&dhtPinState, dhtPinTable);
    if (dhtPinHandle == NULL) {
        return false;
    }

    /* Active l'horloge du peripherique GPT0 en mode actif, ET pendant le
     * sommeil / sommeil profond, pour que le timer continue de tourner
     * meme quand TI-RTOS met le CPU en standby entre deux Task_sleep(). */
    PRCMPeripheralRunEnable(PRCM_PERIPH_TIMER0);
    PRCMPeripheralSleepEnable(PRCM_PERIPH_TIMER0);
    PRCMPeripheralDeepSleepEnable(PRCM_PERIPH_TIMER0);
    PRCMLoadSet();
    while (!PRCMLoadGet()) {
        /* attente de la prise en compte par le domaine d'horloge */
    }

    TimerConfigure(GPT0_BASE, TIMER_CFG_PERIODIC_UP);
    TimerLoadSet(GPT0_BASE, TIMER_A, 0xFFFFFFFF);
    TimerEnable(GPT0_BASE, TIMER_A);

    dhtTimerReady = true;
    return true;
}

DHT11_Status DHT11_read(DHT11_Data *data)
{
    if (dhtPinHandle == NULL || !dhtTimerReady) {
        return DHT11_ERROR_INIT;
    }

    uint8_t bytes[5] = {0, 0, 0, 0, 0};

    /* 1. Signal de start : ligne maintenue basse 18-20 ms */
    pinDriveLow();
    delayUs(DHT11_START_LOW_US);

    /* 2. Relachement de la ligne (entree, pull-up) */
    pinReleaseAsInput();
    delayUs(DHT11_RELEASE_US);

    /* 3. Reponse du capteur attendue : ~80us bas puis ~80us haut */
    if (!waitForLevel(0, DHT11_RESPONSE_TIMEOUT)) return DHT11_ERROR_TIMEOUT_START;
    if (!waitForLevel(1, DHT11_RESPONSE_TIMEOUT)) return DHT11_ERROR_TIMEOUT_START;
    if (!waitForLevel(0, DHT11_RESPONSE_TIMEOUT)) return DHT11_ERROR_TIMEOUT_START;

    /* 4. Lecture des 40 bits (5 octets : humidite, decimale, temp, decimale, checksum) */
    {
        int bitIndex;
        uint32_t highStart;
        uint32_t highDurationTicks;
        uint8_t byteIdx;

        for (bitIndex = 0; bitIndex < 40; bitIndex++) {

            /* chaque bit commence par ~50us a l'etat bas */
            if (!waitForLevel(1, DHT11_BIT_TIMEOUT)) return DHT11_ERROR_TIMEOUT_BIT;

            highStart = ticks();
            if (!waitForLevel(0, DHT11_BIT_TIMEOUT)) return DHT11_ERROR_TIMEOUT_BIT;
            highDurationTicks = elapsedTicks(highStart);

            byteIdx = bitIndex / 8;
            bytes[byteIdx] = (uint8_t)(bytes[byteIdx] << 1);
            if (highDurationTicks > US_TO_TICKS(DHT11_BIT_THRESHOLD_US)) {
                bytes[byteIdx] |= 0x01;
            }
        }
    }

    /* 5. Verification du checksum (somme des 4 premiers octets, tronquee sur 8 bits) */
    uint8_t checksum = (uint8_t)(bytes[0] + bytes[1] + bytes[2] + bytes[3]);
    if (checksum != bytes[4]) {
        return DHT11_ERROR_CHECKSUM;
    }

    /* Le DHT11 (contrairement au DHT22) fournit des valeurs entieres ;
     * les octets de decimale sont toujours a 0. */
    data->humidity    = bytes[0];
    data->temperature = bytes[2];

    return DHT11_OK;
}
