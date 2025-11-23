#!/bin/bash
cd /d/c/Project-Ali/packages/mobile
npx jest --no-cache --runInBand 2>&1 > test_full_output.txt
cat test_full_output.txt
