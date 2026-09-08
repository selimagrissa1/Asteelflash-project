/*
 * dht11.h
 *
 * Driver bit-banging pour capteur DHT11 (module 3 broches) sur CC1310 LaunchPad.
 * SimpleLink CC13x0 SDK 4.20.02.07, projet TI-RTOS, CCS Compiler.
 *
 * Cablage :
 *   DHT11 VCC  -> 3.3V
 *   DHT11 GND  -> GND
 *   DHT11 DATA -> DIO24
 *
 * Implementation basee sur :
 *  - ti/drivers/PIN.h                          (broche bidirectionnelle one-wire)
 *  - ti/devices/cc13x0/driverlib/timer.h        (compteur GPT0 bas niveau, 48 MHz)
 *  - ti/devices/cc13x0/driverlib/prcm.h         (activation horloge peripherique)
 *
 * NOTE : ti/drivers/Timer.h n'existe pas dans le SDK CC13x0 (contrairement au SDK
 * CC13x2/CC26x2). C'est pourquoi on pilote le GPTimer directement via driverlib.
 */

#ifndef DHT11_H_
#define DHT11_H_

#include <stdint.h>
#include <stdbool.h>
#include <ti/drivers/PIN.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int temperature;  /* degres Celsius (DHT11 : toujours entier) */
    int humidity;      /* %HR (DHT11 : toujours entier) */
} DHT11_Data;

typedef enum {
    DHT11_OK = 0,
    DHT11_ERROR_TIMEOUT_START,   /* le capteur ne repond pas au signal de start */
    DHT11_ERROR_TIMEOUT_BIT,     /* timeout pendant la lecture d'un bit */
    DHT11_ERROR_CHECKSUM,        /* checksum invalide */
    DHT11_ERROR_INIT             /* PIN_open a echoue */
} DHT11_Status;

/*
 * DHT11_init
 *   ioid : identifiant IOID de la broche DATA (utiliser IOID_24)
 *
 * A appeler une seule fois, apres Board_init().
 * Retourne true si l'initialisation a reussi.
 */
bool DHT11_init(PIN_Id ioid);

/*
 * DHT11_read
 *   Effectue une lecture complete et bloquante du capteur (~20-25 ms).
 *   Ne pas appeler plus d'une fois toutes les 2 secondes (limite du DHT11).
 */
DHT11_Status DHT11_read(DHT11_Data *data);

#ifdef __cplusplus
}
#endif

#endif /* DHT11_H_ */
