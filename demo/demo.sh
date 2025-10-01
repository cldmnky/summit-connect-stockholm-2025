#!/bin/bash

########################
# include the magic
########################
. scripts/demo-magic.sh

# hide the evidence
clear

# Copy the needed files to the remote
scp scripts/demo-magic.sh rhel@10.201.0.230: > /dev/null 2>&1
scp scripts/rhel-builder.sh rhel@10.201.0.230: > /dev/null 2>&1

p "ssh -l rhel 10.201.0.230"
ssh -t rhel@10.201.0.230 './rhel-builder.sh'