/*
 * Copyright (c) 2015-2018, Texas Instruments Incorporated
 * All rights reserved.
 * (voir licence complete dans le fichier original du SDK)
 */

/*
 *  ======== rfEasyLinkRx.c ========
 *  Carte B (recepteur) - reception radio EasyLink, relais du payload
 *  recu vers l'UART (meme format DATA,../ERR,.. que la carte A, donc
 *  dht11_logger.py fonctionne SANS AUCUNE MODIFICATION, en pointant
 *  simplement son SERIAL_PORT vers CETTE carte B).
 */

/* Standard C libraries */
#include <string.h>

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
#include <ti/drivers/UART.h>

/* Board Header files */
#include "Board.h"

/* EasyLink API Header files */
#include "easylink/EasyLink.h"

/***** Defines *****/

/* Async desactive : on utilise la version synchrone (bloquante) de
 * EasyLink_receive, plus simple et suffisante ici (une mesure/2s cote Tx). */
/* #define RFEASYLINKRX_ASYNC */

#define RFEASYLINKRX_TASK_STACK_SIZE    1024
#define RFEASYLINKRX_TASK_PRIORITY      2


/* Pin driver handle */
static PIN_Handle ledPinHandle;
static PIN_State ledPinState;

/*
 * Application LED pin configuration table:
 *   - All LEDs board LEDs are off.
 */
PIN_Config pinTable[] = {
    Board_PIN_LED1 | PIN_GPIO_OUTPUT_EN | PIN_GPIO_LOW | PIN_PUSHPULL | PIN_DRVSTR_MAX,
    Board_PIN_LED2 | PIN_GPIO_OUTPUT_EN | PIN_GPIO_LOW | PIN_PUSHPULL | PIN_DRVSTR_MAX,
    PIN_TERMINATE
};

/***** Variable declarations *****/
static Task_Params rxTaskParams;
Task_Struct rxTask;    /* not static so you can see in ROV */
static uint8_t rxTaskStack[RFEASYLINKRX_TASK_STACK_SIZE];

/* The RX Output struct contains statistics about the RX operation of the radio */
PIN_Handle pinHandle;

#ifdef RFEASYLINKRX_ASYNC
static Semaphore_Handle rxDoneSem;
#endif

/* ---- UART (relais vers le PC) ---- */
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

/* Relaye le payload recu (suppose etre une chaine C, cf. cote Tx) vers l'UART,
 * en ajoutant \r\n. Protection contre un payload non termine par un \0. */
static void relayPacketToUart(EasyLink_RxPacket *rxPacket)
{
    char line[80];
    uint8_t len = rxPacket->len;

    if (len >= sizeof(line)) {
        len = sizeof(line) - 1;
    }

    memcpy(line, rxPacket->payload, len);
    line[len] = '\0'; /* garantit la terminaison, meme si le payload recu ne l'etait pas */

    uartPrint(line);
    uartPrint("\r\n");
}

/***** Function definitions *****/
#ifdef RFEASYLINKRX_ASYNC
void rxDoneCb(EasyLink_RxPacket * rxPacket, EasyLink_Status status)
{
    if (status == EasyLink_Status_Success)
    {
        /* Toggle LED2 to indicate RX */
        PIN_setOutputValue(pinHandle, Board_PIN_LED2,!PIN_getOutputValue(Board_PIN_LED2));
        relayPacketToUart(rxPacket);
    }
    else if(status == EasyLink_Status_Aborted)
    {
        /* Toggle LED1 to indicate command aborted */
        PIN_setOutputValue(pinHandle, Board_PIN_LED1,!PIN_getOutputValue(Board_PIN_LED1));
    }
    else
    {
        /* Toggle LED1 and LED2 to indicate error */
        PIN_setOutputValue(pinHandle, Board_PIN_LED1,!PIN_getOutputValue(Board_PIN_LED1));
        PIN_setOutputValue(pinHandle, Board_PIN_LED2,!PIN_getOutputValue(Board_PIN_LED2));
    }

    Semaphore_post(rxDoneSem);
}
#endif

static void rfEasyLinkRxFnx(UArg arg0, UArg arg1)
{
#ifndef RFEASYLINKRX_ASYNC
    EasyLink_RxPacket rxPacket = {0};
#endif

#ifdef RFEASYLINKRX_ASYNC
    /* Create a semaphore for Async*/
    Semaphore_Params params;
    Error_Block eb;

    /* Init params */
    Semaphore_Params_init(&params);
    Error_init(&eb);

    /* Create semaphore instance */
    rxDoneSem = Semaphore_create(0, &params, &eb);
    if(rxDoneSem == NULL)
    {
        System_abort("Semaphore creation failed");
    }

#endif //RFEASYLINKRX_ASYNC

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
    uartPrint("ERR,Demarrage carte B (recepteur radio)\r\n");

    while(1) {
#ifdef RFEASYLINKRX_ASYNC
        EasyLink_receiveAsync(rxDoneCb, 0);

        /* Wait 300ms for Rx */
        if(Semaphore_pend(rxDoneSem, (300000 / Clock_tickPeriod)) == FALSE)
        {
            /* RX timed out abort */
            if(EasyLink_abort() == EasyLink_Status_Success)
            {
               /* Wait for the abort */
               Semaphore_pend(rxDoneSem, BIOS_WAIT_FOREVER);
            }
        }
#else
        rxPacket.absTime = 0;
        EasyLink_Status result = EasyLink_receive(&rxPacket);

        if (result == EasyLink_Status_Success)
        {
            /* Toggle LED2 to indicate RX */
            PIN_setOutputValue(pinHandle, Board_PIN_LED2,!PIN_getOutputValue(Board_PIN_LED2));
            relayPacketToUart(&rxPacket);
        }
        else
        {
            /* Toggle LED1 and LED2 to indicate error */
            PIN_setOutputValue(pinHandle, Board_PIN_LED1,!PIN_getOutputValue(Board_PIN_LED1));
            PIN_setOutputValue(pinHandle, Board_PIN_LED2,!PIN_getOutputValue(Board_PIN_LED2));
        }
#endif //RX_ASYNC
    }
}

void rxTask_init(PIN_Handle ledPinHandleIn) {
    pinHandle = ledPinHandleIn;

    Task_Params_init(&rxTaskParams);
    rxTaskParams.stackSize = RFEASYLINKRX_TASK_STACK_SIZE;
    rxTaskParams.priority = RFEASYLINKRX_TASK_PRIORITY;
    rxTaskParams.stack = &rxTaskStack;
    rxTaskParams.arg0 = (UInt)1000000;

    Task_construct(&rxTask, rfEasyLinkRxFnx, &rxTaskParams, NULL);
}

/*
 *  ======== main ========
 */
int main(void)
{
    /* Call driver init functions */
    Board_initGeneral();

    /* Open LED pins */
    ledPinHandle = PIN_open(&ledPinState, pinTable);
    Assert_isTrue(ledPinHandle != NULL, NULL);

    /* Clear LED pins */
    PIN_setOutputValue(ledPinHandle, Board_PIN_LED1, 0);
    PIN_setOutputValue(ledPinHandle, Board_PIN_LED2, 0);

    rxTask_init(ledPinHandle);

    /* Start BIOS */
    BIOS_start();

    return (0);
}
