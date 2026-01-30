#!/bin/bash
set -e

# UID should always be set but just in case
if [ -z $UID ]; then
  UID=$(id -u)
fi  

# set GID if not already set
if [ -z $GID ]; then 
  GID=$(id -g)
fi 

export GID UID