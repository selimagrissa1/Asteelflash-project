COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR ?= $(abspath ../../../../../../..)

include $(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/imports.mak

KERNEL_BUILD := $(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/builds/CC1310_LAUNCHXL/release

CC = "$(CCS_ARMCOMPILER)/bin/armcl"
LNK = "$(CCS_ARMCOMPILER)/bin/armcl"

OBJECTS = easylink_config.obj EasyLink.obj smartrf_settings.obj smartrf_settings_predefined.obj rfEasyLinkRx.obj CC1310_LAUNCHXL.obj CC1310_LAUNCHXL_fxns.obj ccfg.obj

CONFIGPKG = $(KERNEL_BUILD)/ccs

NAME = rfEasyLinkRx

CFLAGS = -I../.. \
    -DDeviceFamily_CC13X0 \
    -DCCFG_FORCE_VDDR_HH=0 \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source" \
    -DSUPPORT_PHY_CUSTOM \
    -DSUPPORT_PHY_50KBPS2GFSK \
    -DSUPPORT_PHY_625BPSLRM \
    -DSUPPORT_PHY_5KBPSSLLR \
    "-I$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source/ti/posix/ccs" \
    --silicon_version=7M3 \
    --code_state=16 \
    --little_endian \
    --display_error_number \
    --diag_warning=255 \
    --diag_wrap=off \
    --gen_func_subsections=on \
    --float_support=vfplib \
    --symdebug:dwarf \
    "-I$(CCS_ARMCOMPILER)/include"

LFLAGS = "-i$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/source" \
    -lti/display/lib/display.aem3 \
    -lti/grlib/lib/ccs/m3/grlib.a \
    -lthird_party/spiffs/lib/ccs/m3/spiffs_cc26xx.a \
    -lti/drivers/rf/lib/rf_multiMode_cc13x0.aem3 \
    -lti/drivers/lib/drivers_cc13x0.aem3 \
    "-i$(COM_TI_SIMPLELINK_CC13X0_SDK_INSTALL_DIR)/kernel/tirtos/packages" \
    -lti/dpl/lib/dpl_cc13x0.aem3 \
    "-l$(KERNEL_BUILD)/ccs/linker.cmd" \
    -lti/devices/cc13x0/driverlib/bin/ccs/driverlib.lib \
    ../../tirtos/ccs/CC1310_LAUNCHXL_TIRTOS.cmd \
    "-m$(NAME).map" \
    --warn_sections \
    --display_error_number \
    --diag_wrap=off \
    --rom_model \
    "-i$(CCS_ARMCOMPILER)/lib" \
    -llibc.a

all: $(NAME).out

$(CONFIGPKG)/linker.cmd $(CONFIGPKG)/compiler.opt:
	@ $(ECHOBLANKLINE)
	@ echo $(CONFIGPKG) is not built.
	@ echo You can build it by issuing $(MAKE) in $(CONFIGPKG).
	@ $(ECHOBLANKLINE)

easylink_config.obj: ../../easylink/easylink_config.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

EasyLink.obj: ../../easylink/EasyLink.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

smartrf_settings.obj: ../../smartrf_settings/smartrf_settings.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

smartrf_settings_predefined.obj: ../../smartrf_settings/smartrf_settings_predefined.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

rfEasyLinkRx.obj: ../../rfEasyLinkRx.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

CC1310_LAUNCHXL.obj: ../../CC1310_LAUNCHXL.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

CC1310_LAUNCHXL_fxns.obj: ../../CC1310_LAUNCHXL_fxns.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

ccfg.obj: ../../ccfg.c $(CONFIGPKG)/compiler.opt
	@ echo Building $@
	@ $(CC) $(CFLAGS) $< --cmd_file=$(CONFIGPKG)/compiler.opt --output_file=$@

$(NAME).out: $(OBJECTS) $(CONFIGPKG)/linker.cmd
	@ echo linking $@
	@ $(LNK) $(CFLAGS) -z $(OBJECTS) $(LFLAGS) -o $(NAME).out

clean:
	@ echo Cleaning...
	@ $(RM) $(OBJECTS) > $(DEVNULL) 2>&1
	@ $(RM) $(NAME).out > $(DEVNULL) 2>&1
	@ $(RM) $(NAME).map > $(DEVNULL) 2>&1
