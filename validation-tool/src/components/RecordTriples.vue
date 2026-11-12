<script setup lang="ts">
import {compact} from '../iri.ts';
import type {RecordVersion} from '../types.ts';
import RdfNode from './RdfNode.vue';

defineProps<{version: RecordVersion}>();

const view = defineModel<'tree' | 'turtle'>('view', {default: 'tree'});
</script>

<template>
  <div class="tabs">
    <button :class="{active: view === 'tree'}" @click="view = 'tree'">Tree</button>
    <button :class="{active: view === 'turtle'}" @click="view = 'turtle'">Turtle</button>
  </div>
  <div v-if="view === 'turtle'" class="turtle" v-html="version.turtle" />
  <div v-else class="rdf-tree">

    <section v-for="root in version.tree" :key="root.id">
      <div class="rdf-subject">
        <a :href="root.id" target="_blank" rel="noreferrer">{{ compact(root.id) }}</a>
        <span v-for="type in root.types" :key="type" class="rdf-type">{{ compact(type) }}</span>
      </div>
      <RdfNode :node="root" />
    </section>
    
  </div>
</template>
