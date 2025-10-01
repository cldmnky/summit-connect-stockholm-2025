#!/usr/bin/env bash

#################################
# include the -=magic=-
# you can pass command line args
#
# example:
# to disable simulated typing
# . ../demo-magic.sh -d
#
# pass -h to see all options
#################################

# note that -d is passed to disable simulated typing
# install pv https://www.ivarch.com/programs/pv.shtml onto your remote server
# if you want simulated typing
. ./demo-magic.sh


########################
# Configure the options
########################

#
# speed at which to simulate typing. bigger num = faster
#
# TYPE_SPEED=20

#
# custom prompt
#
# see http://www.tldp.org/HOWTO/Bash-Prompt-HOWTO/bash-prompt-escape-sequences.html for escape sequences
# [rhel@rhel-builder ~]$
DEMO_PROMPT="${GREEN}[\u@\h \W]$ ${COLOR_RESET}"
#DEMO_PROMPT="${GREEN}(my fancy server)➜ ${CYAN}\W ${COLOR_RESET}"

# text color
# DEMO_CMD_COLOR=$BLACK

pe cd summit-connect-stockholm-2025/demo/bootc/summit-connect-base/
p ""