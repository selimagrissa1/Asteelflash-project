COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR ?= $(abspath ../../../../../../..)

include $(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/imports.mak

KERNEL_BUILD := $(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/builds/CC1310_LAUNCHXL/release

CC = "$(GCC_ARMCOMPILER)/bin/arm-none-eabi-gcc"
LNK = "$(GCC_ARMCOMPILER)/bin/arm-none-eabi-gcc"

OBJECTS = easylink_config.obj EasyLink.obj smartrf_settings.obj smartrf_settings_predefined.obj rfEasyLinkRx.obj CC1310_LAUNCHXL.obj CC1310_LAUNCHXL_fxns.obj ccfg.obj

CONFIGPKG = $(KERNEL_BUILD)/gcc

NAME = rfEasyLinkRx

CFLAGS = -I../.. \
    -DDeviceFamily_CC13X0 \
    -DCCFG_FORCE_VDDR_HH=0 \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source" \
    -DSUPPORT_PHY_CUSTOM \
    -DSUPPORT_PHY_50KBPS2GFSK \
    -DSUPPORT_PHY_625BPSLRM \
    -DSUPPORT_PHY_5KBPSSLLR \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source/ti/posix/gcc" \
    -mcpu=cortex-m3 \
    -march=armv7-m \
    -mthumb \
    -std=c99 \
    -mfloat-abi=soft \
    -ffunction-sections \
    -fdata-sections \
    -g \
    -gstrict-dwarf \
    -Wall \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/packages/gnu/targets/arm/libs/install-native/arm-none-eabi/include/newlib-nano" \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/packages/gnu/targets/arm/libs/install-native/arm-none-eabi/include" \
    "-I$(GCC_ARMCOMPILER)/arm-none-eabi/include"

LFLAGS = -Wl,-T,../../tirtos/gcc/CC1310_LAUNCHXL_TIRTOS.lds \
    "-Wl,-Map,$(NAME).map" \
    "-L$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source" \
    -l:ti/display/lib/display.am3g \
    -l:ti/grlib/lib/gcc/m3/grlib.a \
    -l:third_party/spiffs/lib/gcc/m3/spiffs_cc26xx.a \
    -l:ti/drivers/rf/lib/rf_multiMode_cc13x0.am3g \
    -l:ti/drivers/lib/drivers_cc13x0.am3g \
    "-L$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/packages" \
    -l:ti/dpl/lib/dpl_cc13x0.am3g \
    "-Wl,-T,$(KERNEL_BUILD)/gcc/linker.cmd" \
    -l:ti/devices/cc13x0/driverlib/bin/gcc/driverlib.lib \
    -march=armv7-m \
    -mthumb \
    -nostartfiles \
    -static \
    -Wl,--gc-sections \
    "-L$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/packages/gnu/targets/arm/libs/install-native/arm-none-eabi/lib/thumb/v7-m" \
    "-L$(GCC_ARMCOMPILER)/arm-none-eabi/lib" \
    -lgcc \
    -lc \
    -lm \
    -lnosys \
    --specs=nano.specs

all: $(NAME).out

$(CONFIGPKG)/linker.cmd $(CONFIGPKG)/compiler.opt:
	@ $(ECHOBLANKLINE)
	@ echo $(CONFIGPKG) is not built.
	@ echo You can build it by issuing $(MAKE) in $(CONFIGPKG).
	@ $(ECHOBLANKLINE)

easylink_config.obj: ../../easylink/easylink_config.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

EasyLink.obj: ../../easylink/EasyLink.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

smartrf_settings.obj: ../../smartrf_settings/smartrf_settings.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

smartrf_settings_predefined.obj: ../../smartrf_settings/smartrf_settings_predefined.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

rfEasyLinkRx.obj: ../../rfEasyLinkRx.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

CC1310_LAUNCHXL.obj: ../../CC1310_LAUNCHXL.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

CC1310_LAUNCHXL_fxns.obj: ../../CC1310_LAUNCHXL_fxns.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

ccfg.obj: ../../ccfg.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< -c @$(CONFIGPKG)/compiler.opt -o $@

$(NAME).out: $(OBJECTS) $(CONFIGPKG)/linker.cmd
	@ echo linking $@
	@ $(LNK)  $(OBJECTS) $(LFLAGS) -o $(NAME).out

clean:
	@ echo Cleaning...
	@ $(RM) $(OBJECTS) > $(DEVNULL) 2>&1
	@ $(RM) $(NAME).out > $(DEVNULL) 2>&1
	@ $(RM) $(NAME).map > $(DEVNULL) 2>&1
