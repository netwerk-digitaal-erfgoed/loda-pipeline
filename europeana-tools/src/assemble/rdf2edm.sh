#!/bin/sh

DIR=$(dirname "$(readlink -f "$0")")
exec java -Djava.util.logging.config.file="$DIR/logging.properties" -Dsun.net.inetaddr.ttl=0 $JVM_ARGS -cp "$DIR/classes:$DIR/lib/*" eu.europeana.commonculture.lod.rdf2edmxml.Rdf2EdmCl "$@"
