<script setup lang="ts">
import {compact} from '../iri.ts';
import type {RdfNode} from '../types.ts';

defineProps<{node: RdfNode}>();

const LABELS = [
  'http://www.w3.org/2000/01/rdf-schema#label',
  'https://schema.org/name',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
];

/** A node that has only types and a label, shown in one line. */
function labelOnly(node: RdfNode): boolean {
  return (
    node.properties.length === 1 &&
    LABELS.includes(node.properties[0].predicate) &&
    node.properties[0].values.every(value => value.kind === 'literal')
  );
}

function labels(node: RdfNode): string {
  return node.properties[0].values.map(value => (value.kind === 'literal' ? value.value : '')).join(' / ');
}
</script>

<template>
  <ul class="rdf-properties">
    <li v-for="property in node.properties" :key="property.predicate">
      <span class="rdf-predicate" :title="property.predicate">{{ compact(property.predicate) }}</span>
      <ul class="rdf-values">
        <li v-for="(value, index) in property.values" :key="index">
          
          <template v-if="value.kind === 'literal'">
            <span class="rdf-literal">{{ value.value }}</span>
            <span v-if="value.language" class="rdf-annotation">@{{ value.language }}</span>
            <span v-else-if="value.datatype" class="rdf-annotation">{{ compact(value.datatype) }}</span>
          </template>

          <a v-else-if="value.kind === 'iri'" :href="value.value" target="_blank" rel="noreferrer">
            {{ compact(value.value) }}
          </a>

          <template v-else-if="labelOnly(value.node)">
            <span class="rdf-literal">{{ labels(value.node) }}</span>
            <span v-for="type in value.node.types" :key="type" class="rdf-type">{{ compact(type) }}</span>
          </template>
          
          <details v-else open>
            <summary>
              <a v-if="!value.node.blank" :href="value.node.id" target="_blank" rel="noreferrer">
                {{ compact(value.node.id) }}
              </a>
              <span v-for="type in value.node.types" :key="type" class="rdf-type">{{ compact(type) }}</span>
              <span v-if="value.node.blank && value.node.types.length === 0" class="rdf-annotation">[ ]</span>
            </summary>
            <RdfNode :node="value.node" />
          </details>

        </li>
      </ul>
    </li>
  </ul>
</template>
