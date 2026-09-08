/*
 * Copyright (c) 2017-2018, Texas Instruments Incorporated
 * All rights reserved.
 * (voir licence complete dans le fichier original du SDK)
 */

/*
 *  ======== rfEasyLinkTx.c ========
 *  Carte A (capteur) - lecture DHT11 (DIO24), envoi radio EasyLink
 *  ET envoi UART (les deux sont actifs en parallele, l'UART sert au
 *  debug local pendant la mise au point ; seule la radio est necessaire
 *  une fois la carte B en place).
 */

/* Standard C Libraries */
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* XDCtools Header files */
#include <xdc/std.h>
#include <xdc/runtime/Assert.h>
#include <xdc/runtime/Error.h>
#include <xdc/runtime/System.h>

/* BIOS Header files */
#include <ti/sysbios/BIOS.h>
#include <ti/sysbios/knl/Task.h>
#include <ti/sysbios/knl/Semaphore.h>
#include <ti/sysbios/knl/Clock.h>

/* TI-RTOS Header files */
#include <ti/drivers/PIN.h>
#include <ti/drivers/pin/PINCC26XX.h>
#include <ti/drivers/UART.h>

/* Board Header files */
#include "Board.h"

/* EasyLink API Header files */
#include "easylink/EasyLink.h"

/* Application header files */
#include "smartrf_settings/smartrf_settings.h"

/* Driver DHT11 (voir dht11.h/dht11.c) */
#include "dht11.h"

/* Async desactive : on utilise la version synchrone (bloquante) de
 * EasyLink_transmit, plus simple et largement suffisante a 1 mesure/2s. */
/* #define RFEASYLINKTX_ASYNC */

#define RFEASYLINKTX_TASK_STACK_SIZE    1024
#define RFEASYLINKTX_TASK_PRIORITY      2

#define DHT11_DATA_PIN                  IOID_24
#define RADIO_DST_ADDR                  0xAA   /* doit correspondre au filtre configure sur la carte B */

Task_Struct txTask;    /* not static so you can see in ROV */
static Task_Params txTaskParams;
static uint8_t txTaskStack[RFEASYLINKTX_TASK_STACK_SIZE];

/* Pin driver handle (LEDs) */
static PIN_Handle pinHandle;
static PIN_State pinState;

/*
 * Application LED pin configuration table:
 *   - All LEDs board LEDs are off.
 */
PIN_Config pinTable[] = {
    Board_PIN_LED1 | PIN_GPIO_OUTPUT_EN | PIN_GPIO_LOW | PIN_PUSHPULL | PIN_DRVSTR_MAX,
    Board_PIN_LED2 | PIN_GPIO_OUTPUT_EN | PIN_GPIO_LOW | PIN_PUSHPULL | PIN_DRVSTR_MAX,
    PIN_TERMINATE
};

/* ---- UART (garde en parallele de la radio, utile pour le debug local) ---- */
static UART_Handle uartHandle;

static void uartInit(void)
{
    UART_Params uartParams;

    UART_init();

    UART_Params_init(&uartParams);
    uartParams.baudRate      = 115200;
    uartParams.readMode      = UART_MODE_BLOCKING;
    uartParams.writeMode     = UART_MODE_BLOCKING;
    uartParams.readDataMode  = UART_DATA_TEXT;
    uartParams.writeDataMode = UART_DATA_TEXT;

    uartHandle = UART_open(Board_UART0, &uartParams);
}

static void uartPrint(const char *msg)
{
    if (uartHandle != NULL) {
        UART_write(uartHandle, msg, strlen(msg));
    }
}

static void rfEasyLinkTxFnx(UArg arg0, UArg arg1)
{
    char line[64];
    DHT11_Data data;
    DHT11_Status status;

    // Initialize the EasyLink parameters to their default values
    EasyLink_Params easyLink_params;
    EasyLink_Params_init(&easyLink_params);

    /*
     * Initialize EasyLink with the settings found in easylink_config.h
     * Modify EASYLINK_PARAM_CONFIG in easylink_config.h to change the default
     * PHY
     */
    if(EasyLink_init(&easyLink_params) != EasyLink_Status_Success)
    {
        System_abort("EasyLink_init failed");
    }

    /*
     * If you wish to use a frequency other than the default, use
     * the following API:
     * EasyLink_setFrequency(868000000);
     */

    uartInit();
    uartPrint("ERR,Demarrage carte A (DHT11 + radio + UART)\r\n");

    if (!DHT11_init(DHT11_DATA_PIN)) {
        uartPrint("ERR,Impossible d'initialiser le driver DHT11\r\n");
        /* On continue quand meme la tache pour que la radio/LEDs restent
         * visibles, mais DHT11_read renverra DHT11_ERROR_INIT en boucle. */
    }

    while(1) {
        EasyLink_TxPacket txPacket =  { {0}, 0, 0, {0} };

        status = DHT11_read(&data);

        switch (status) {
            case DHT11_OK:
                snprintf(line, sizeof(line), "DATA,%d,%d", data.temperature, data.humidity);
                break;
            case DHT11_ERROR_TIMEOUT_START:
                snprintf(line, sizeof(line), "ERR,Pas de reponse du capteur");
                break;
            case DHT11_ERROR_TIMEOUT_BIT:
                snprintf(line, sizeof(line), "ERR,Timeout lecture bit");
                break;
            case DHT11_ERROR_CHECKSUM:
                snprintf(line, sizeof(line), "ERR,Checksum invalide");
                break;
            default:
                snprintf(line, sizeof(line), "ERR,Driver non initialise");
                break;
        }

        /* Envoi UART (debug local, en parallele de la radio) */
        {
            char lineWithCrlf[66];
            snprintf(lineWithCrlf, sizeof(lineWithCrlf), "%s\r\n", line);
            uartPrint(lineWithCrlf);
        }

        /* Preparation du paquet radio : on inclut le terminateur nul pour que
         * la carte B puisse traiter directement le payload comme une chaine C. */
        txPacket.len = (uint8_t)(strlen(line) + 1);
        if (txPacket.len > sizeof(txPacket.payload)) {
            txPacket.len = sizeof(txPacket.payload);
        }
        memcpy(txPacket.payload, line, txPacket.len);

        /* Adressage : doit correspondre au filtre configure sur la carte B */
        txPacket.dstAddr[0] = RADIO_DST_ADDR;

        /* Envoi immediat (pas de programmation dans le temps) */
        txPacket.absTime = 0;

        EasyLink_Status result = EasyLink_transmit(&txPacket);

        if (result == EasyLink_Status_Success)
        {
            /* Toggle LED1 to indicate TX */
            PIN_setOutputValue(pinHandle, Board_PIN_LED1,!PIN_getOutputValue(Board_PIN_LED1));
        }
        else
        {
            /* Toggle LED1 and LED2 to indicate error */
            PIN_setOutputValue(pinHandle, Board_PIN_LED1,!PIN_getOutputValue(Board_PIN_LED1));
            PIN_setOutputValue(pinHandle, Board_PIN_LED2,!PIN_getOutputValue(Board_PIN_LED2));
        }

        /* Le DHT11 ne supporte pas des lectures plus rapides que ~1 Hz */
        Task_sleep((2000 * 1000) / Clock_tickPeriod);
    }
}

void txTask_init(PIN_Handle inPinHandle) {
    pinHandle = inPinHandle;

    Task_Params_init(&txTaskParams);
    txTaskParams.stackSize = RFEASYLINKTX_TASK_STACK_SIZE;
    txTaskParams.priority = RFEASYLINKTX_TASK_PRIORITY;
    txTaskParams.stack = &txTaskStack;
    txTaskParams.arg0 = (UInt)1000000;

    Task_construct(&txTask, rfEasyLinkTxFnx, &txTaskParams, NULL);
}

/*
 *  ======== main ========
 */
int main(void)
{
    /* Call driver init functions. */
    Board_initGeneral();

    /* Open LED pins */
    pinHandle = PIN_open(&pinState, pinTable);
    Assert_isTrue(pinHandle != NULL, NULL);

    /* Clear LED pins */
    PIN_setOutputValue(pinHandle, Board_PIN_LED1, 0);
    PIN_setOutputValue(pinHandle, Board_PIN_LED2, 0);

    txTask_init(pinHandle);

    /* Start BIOS */
    BIOS_start();

    return (0);
}
