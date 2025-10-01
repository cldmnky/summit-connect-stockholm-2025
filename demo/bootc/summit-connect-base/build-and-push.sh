#!/usr/bin/env bash
set -euo pipefail

# build-and-push.sh
# Builds the image from Containerfile.bootc, optionally pushes it, and can
# convert the pushed image into a qcow2 using the Red Hat bootc image builder.

IMAGE_DEFAULT="quay.io/cldmnky/summit-connect-base:latest"
CONTAINERFILE="Containerfile.bootc"
RETRIES=3
BUILDER_DEFAULT="registry.redhat.io/rhel10/bootc-image-builder:latest"
QCOW_OUTPUT_DIR="output"

usage() {
	cat <<EOF
Usage: $0 [image] [options]

Positional arguments:
	image                Optional image name (default: $IMAGE_DEFAULT)

Options:
	-h, --help           Show this help
	--qcow               After build/push, run the bootc image builder to create a qcow2
	--no-qcow            Do not run the qcow builder (default)
	--no-push            Build but do not push the image
	--builder <image>    Use this bootc builder image (default: $BUILDER_DEFAULT)
	--output <dir>       Output directory for qcow (default: $QCOW_OUTPUT_DIR)
	--retries <N>        Number of push retries (default: $RETRIES)

Examples:
	# build, push, then create qcow2
	$0 --qcow

	# build and push a custom image but skip the qcow step
	$0 my-registry.example.com/myorg/myimage:tag --no-qcow

EOF
}

DO_QCOW=false
NO_PUSH=false
BUILDER="$BUILDER_DEFAULT"

IMAGE=""

while [[ $# -gt 0 ]]; do
	case "$1" in
		-h|--help)
			usage
			exit 0
			;;
		--qcow)
			DO_QCOW=true; shift
			;;
		--no-qcow)
			DO_QCOW=false; shift
			;;
		--no-push)
			NO_PUSH=true; shift
			;;
		--builder)
			BUILDER="$2"; shift 2
			;;
		--output)
			QCOW_OUTPUT_DIR="$2"; shift 2
			;;
				--qcow-image)
					QCOW_IMAGE="$2"; shift 2
					;;
		--retries)
			RETRIES="$2"; shift 2
			;;
		--)
			shift; break
			;;
		-*)
			echo "Unknown option: $1" >&2; usage; exit 1
			;;
		*)
			if [[ -z "$IMAGE" ]]; then
				IMAGE="$1"; shift
			else
				echo "Unexpected argument: $1" >&2; usage; exit 1
			fi
			;;
	esac
done

IMAGE="${IMAGE:-$IMAGE_DEFAULT}"
QCOW_IMAGE=""

if [[ ! -f "$CONTAINERFILE" ]]; then
	echo "ERROR: ${CONTAINERFILE} not found in $(pwd). Run this script from the directory that contains ${CONTAINERFILE}."
	exit 2
fi

if command -v podman >/dev/null 2>&1; then
	CLI=podman
elif command -v docker >/dev/null 2>&1; then
	CLI=docker
else
	echo "ERROR: neither podman nor docker found in PATH. Install one to build images."
	exit 3
fi

echo -e "\033[36mUsing container CLI: $CLI\033[0m"
echo -e "\033[33mBuilding \033[36m${CONTAINERFILE}\033[33m -> \033[32m${IMAGE}\033[0m"
# pause for dramatic effect
sleep 16

# Build the image
if [[ "$CLI" == "podman" ]]; then
	$CLI build -f "$CONTAINERFILE" -t "$IMAGE" .
else
	$CLI build -f "$CONTAINERFILE" -t "$IMAGE" .
fi

if [[ "$NO_PUSH" == true ]]; then
	echo "Skipping push (--no-push). Built image: $IMAGE"
else
	echo "Build complete. Pushing ${IMAGE}"
	push_attempts=0
	until [[ $push_attempts -ge $RETRIES ]]; do
		set +e
		$CLI push "$IMAGE"
		rc=$?
		set -e
		if [[ $rc -eq 0 ]]; then
			echo "Push succeeded"
			break
		fi
		push_attempts=$((push_attempts + 1))
		echo "Push failed (attempt ${push_attempts}/${RETRIES}), retrying in $((push_attempts * 2))s..."
		sleep $((push_attempts * 2))
	done
	if [[ $push_attempts -ge $RETRIES ]]; then
		echo "ERROR: push failed after ${RETRIES} attempts"
		exit 4
	fi
fi

if [[ "$DO_QCOW" == true ]]; then
	# QCOW creation requires podman and likely sudo for --privileged
	if ! command -v podman >/dev/null 2>&1; then
		echo "ERROR: podman required to run the bootc image builder. Install podman."
		exit 5
	fi

	SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	OUTPUT_DIR="$SCRIPT_DIR/$QCOW_OUTPUT_DIR"
	mkdir -p "$OUTPUT_DIR"

	echo -e "\033[33mMake sure you're logged into the registries if they require authentication:\033[0m"
	echo -e "  \033[36mpodman login quay.io\033[0m"
	echo -e "  \033[36mpodman login registry.redhat.io\033[0m"

	echo -e "\033[35mRunning bootc image builder...\033[33m output will be written to: \033[32m$OUTPUT_DIR\033[0m"

	# Ensure root's podman store has the image (the builder runs under sudo)
	if ! sudo podman image exists "$IMAGE" >/dev/null 2>&1; then
		MOVE_SCRIPT="$SCRIPT_DIR/move-image-to-root.sh"
		if [[ -x "$MOVE_SCRIPT" ]]; then
			echo "Image $IMAGE not present in root's podman store. Transferring using $MOVE_SCRIPT"
			"$MOVE_SCRIPT" "$IMAGE"
		else
			echo "move-image-to-root.sh not found at $MOVE_SCRIPT. Please ensure the image is available to root (sudo podman pull $IMAGE)"
			exit 7
		fi
	else
		echo "Image present in root's podman store."
	fi

	cmd=(sudo podman run --rm --privileged --pull=newer --security-opt label=type:unconfined_t \
		-v "$OUTPUT_DIR":/output \
		-v /var/lib/containers/storage:/var/lib/containers/storage \
		"$BUILDER" --type qcow2 "$IMAGE")

	echo -e "\033[34mCommand: \033[36m${cmd[*]}\033[0m"
	# sleep for dramatic effect
	sleep 16
	# Run the command
	"${cmd[@]}"

	echo "Builder finished. Check $OUTPUT_DIR for the generated qcow2 file(s)."

		# If a Containerfile.qcow2 exists, build it into a container image that bundles the qcow
		CONTAINERFILE_QCOW="$SCRIPT_DIR/Containerfile.qcow2"
		if [[ -f "$CONTAINERFILE_QCOW" ]]; then
			# Default qcow image tag: same repo as IMAGE but with :qcow2
			if [[ -z "${QCOW_IMAGE:-}" ]]; then
				QCOW_IMAGE_TAG="${IMAGE%:*}:qcow2"
			else
				QCOW_IMAGE_TAG="$QCOW_IMAGE"
			fi

			echo -e "\033[32mFound Containerfile.qcow2; \033[33mbuilding qcow container image \033[33m-> \033[36m$QCOW_IMAGE_TAG\033[0m"
			# Build context should be the script dir so the Containerfile.qcow2 can reference files in output/
			# Ensure the qcow file the Containerfile expects is present in the build context.
			QCOW_SRC="$OUTPUT_DIR/qcow2/disk.qcow2"
			QCOW_DST="$SCRIPT_DIR/disk.qcow2"
			CLEANUP_QCOW=false
			if [[ -f "$QCOW_SRC" ]]; then
				echo -e "\033[33mCopying \033[36m$QCOW_SRC\033[33m -> \033[32m$QCOW_DST\033[33m for build context\033[0m"
				cp -f "$QCOW_SRC" "$QCOW_DST"
				CLEANUP_QCOW=true
			else
				echo "Warning: expected qcow at $QCOW_SRC not found; Containerfile.qcow2 ADD may fail"
			fi
			pushd "$SCRIPT_DIR" >/dev/null
			if [[ "$CLI" == "podman" ]]; then
				echo -e "\033[34mCommand: \033[36mpodman build -f Containerfile.qcow2 -t $QCOW_IMAGE_TAG .\033[0m"
				# pause for dramatic effect
				sleep 16
				# Build the image
				$CLI build -f Containerfile.qcow2 -t "$QCOW_IMAGE_TAG" .
			else
				$CLI build -f Containerfile.qcow2 -t "$QCOW_IMAGE_TAG" .
			fi
			popd >/dev/null
			# Remove temporary copied qcow if we created it
			if [[ "$CLEANUP_QCOW" == true ]]; then
				rm -f "$QCOW_DST"
			fi

			if [[ "$NO_PUSH" == true ]]; then
				echo "Skipping push of qcow image (--no-push). Built image: $QCOW_IMAGE_TAG"
			else
				echo "Pushing qcow image: $QCOW_IMAGE_TAG"
				push_attempts=0
				until [[ $push_attempts -ge $RETRIES ]]; do
					set +e
					# Add colors and echo command
					echo -e "\033[34mCommand: \033[36m$CLI push $QCOW_IMAGE_TAG\033[0m"
					# pause for dramatic effect
					sleep 16
					$CLI push "$QCOW_IMAGE_TAG"
					rc=$?
					set -e
					if [[ $rc -eq 0 ]]; then
						echo "Push of qcow image succeeded"
						break
					fi
					push_attempts=$((push_attempts + 1))
					echo "qcow image push failed (attempt ${push_attempts}/${RETRIES}), retrying in $((push_attempts * 2))s..."
					sleep $((push_attempts * 2))
				done
				if [[ $push_attempts -ge $RETRIES ]]; then
					echo "ERROR: qcow image push failed after ${RETRIES} attempts"
					exit 6
				fi
			fi
		else
			echo "No Containerfile.qcow2 found in $SCRIPT_DIR; skipping qcow image build."
		fi
fi

echo "All done."

