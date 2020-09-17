#!/usr/bin/env bash
# This script is used to create Carbon Charts private build for Data Explorer (DE).
# prerequisites: yarn is installed


# Carbon Charts project path
CARBON_CHARTS_PATH=/Users/ericyang/workspace/hlyang397/carbon-charts
# Data Explorer project path
DE_PATH=/Users/ericyang/workspace/investigate-tpe/investigate

echo $CARBON_CHARTS_PATH
echo $DE_PATH

# change to project path
cd $CARBON_CHARTS_PATH/packages/core

# 0. clean dist folder
rm -rf dist/

# 1. Build your local package code
yarn run build

# 2. [Required by Carbon Charts] Update package.json in /dist
#    - remove postinstall in ${carbon-charts}/packages/core/dist/package.json scripts section
cd dist
sed '/postinstall/d' ./package.json > ./package2.json
mv ./package2.json ./package.json

#3. Create a tarball (ex: carbon-charts-0.34.##.tgz) from your local package
TARBALL_NAME="`npm pack`"
PRIVATE_TARBALL_NAME="$(basename $TARBALL_NAME .tgz).private.tgz"
echo $TARBALL_NAME
echo $PRIVATE_TARBALL_NAME

#4. [Optional] Change tarball name to carbon-charts-0.34.##.private.tgz
mv $TARBALL_NAME $PRIVATE_TARBALL_NAME

#5. Copy this tarball to investigate project
mv $PRIVATE_TARBALL_NAME $DE_PATH/lib/

# Manually for now
#6. Change $DE_PATH/package.json dependency to
#"@carbon/charts": "file:lib/carbon-charts-0.34.10.private.tgz",
#"@carbon/charts-react": "0.34.10",

#7. $DE_PATH/npm install
