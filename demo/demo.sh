#!/bin/bash

########################
# include the magic
########################
. scripts/demo-magic.sh

# hide the evidence
clear
redhatsay "Let's do some vibe ops 😎 with RHEL 🎩, Bootc 👢📦, and OpenShift ☸️"
wait
clear
redhatsay "We will start by looking at the Containerfile for the summit-connect-base (SOE) image"
wait
clear
cat bootc/summit-connect-base/Containerfile.bootc | gum format -t code -l dockerfile
# Add a gum formatted text block here
echo "🚢 This is our Containerfile that builds a RHEL 10 bootable container. 

What we'll create:
• 📦 Standard OCI container image
• 💿 Bootable qcow2 disk image 
• 🖥️ Ready-to-run VM image

The perfect marriage between VMs and containers!" | gum style --bold --padding="1 2" --margin="1 0" --foreground="117"
wait
clear
echo "🚀 Build Process Starting

We will start by building and pushing the summit-connect-base image.

This will be the fastest RHEL build you have ever seen!" | gum style --bold --padding="1 2" --margin="1 0" --foreground="226" | redhatsay


# Copy the needed files to the remote
# scp scripts/demo-magic.sh rhel@10.201.0.230: > /dev/null 2>&1
# scp scripts/rhel-builder.sh rhel@10.201.0.230: > /dev/null 2>&1

# p "ssh -l rhel 10.201.0.230"
# ssh -t rhel@10.201.0.230 './rhel-builder.sh'

redhatsay "We will remote RHEL builder host to build and push the image"
p "oc get vmi rhel-builder -o wide"
echo 'NAME           AGE     PHASE     IP             NODENAME           READY   LIVE-MIGRATABLE   PAUSED
rhel-builder   7h30m   Running   10.201.0.230   borg.blahonga.me   True    False'
pei ""

asciinema play scripts/bootc-base-edited.cast -q
p ""
# Now we have a bootable RHEL 10 base image in both container and qcow2 formats!
echo "🚀 Now we have a bootable RHEL 10 base image in both container and qcow2 formats!" | gum style --bold --padding="1 2" --margin="1 0" --foreground="82" | redhatsay

# Now we are going to build an application image on top of this base
cat ../Containerfile | gum format -t code -l dockerfile
wait
clear
# Let´s kick off the application build on openshift
redhatsay "Let's build and push the application image on OpenShift"
wait
clear

# I have the application running locally on my laptop, open http://localhost:3001

pei "cd .. && make run-container-arm64 && cd -"
# Open http://localhost:3001 in your browser to see the app running in a container
echo "🚀 The application is now running in a container on my laptop!"
open "http://localhost:3001"
wait
pei "cd .. && make make stop-container && cd -"

# Let´s use openshift builds to build and push this image

# The image is now built and pushed to quay.io/cldmnky/summit-connect-app:latest

# We will deploy this image to our OpenShift using a Helm chart
# It will initially boot the base image

# Ansible EDA will pick up the VM and re-deploy it with the new image using bootc switch

# When the VM is rebooted we will be able to access the application on OpenShift
# Open http://summit-connect.apps.summit-connect-2025.borg.blahonga.me in your browser to see the app running in a VM on OpenShift
echo "🚀 The application is now running in a VM on OpenShift!"
open "http://summit-connect.apps.summit-connect-2025.borg.blahonga.me"
wait
redhatsay "That was a quick demo of vibe ops with RHEL, Bootc, and OpenShift! 🎩👢📦☸️"
wait
clear