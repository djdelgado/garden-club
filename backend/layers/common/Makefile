# SAM makefile build for the CommonLayer (Metadata.BuildMethod: makefile).
# The target name must be build-<LayerLogicalId>. SAM sets ARTIFACTS_DIR to the
# layer's build output; everything under python/ there lands at /opt/python at
# runtime. We both copy the first-party gardenclub_common module and pip-install
# the shared dependencies into the same python/ dir, so the layer is the single
# source of truth for both.
build-CommonLayer:
	mkdir -p "$(ARTIFACTS_DIR)/python"
	cp -r python/. "$(ARTIFACTS_DIR)/python/"
	python -m pip install -r requirements.txt -t "$(ARTIFACTS_DIR)/python"
