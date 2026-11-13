<script setup lang="ts">
import {computed, ref} from 'vue';
import {compact} from '../iri.ts';
import type {Checkpoint, Counts} from '../types.ts';

const props = defineProps<{
  title: string;
  checkpoints: Checkpoint[];
  select: (counts: Counts) => Record<string, number>;
}>();

const filter = ref('');

const rows = computed(() => {
  const iris = new Set(
    props.checkpoints.flatMap(checkpoint =>
      checkpoint.counts ? Object.keys(props.select(checkpoint.counts)) : [],
    ),
  );

  const needle = filter.value.toLowerCase();

  return [...iris]
    .filter(iri => compact(iri).toLowerCase().includes(needle))
    .map(iri => ({
      iri,
      counts: props.checkpoints.map(checkpoint =>
        checkpoint.counts ? props.select(checkpoint.counts)[iri] : undefined,
      ),
    }))
    .sort(
      (a, b) =>
        Math.max(...b.counts.map(count => count ?? 0)) -
        Math.max(...a.counts.map(count => count ?? 0)),
    );
});
</script>

<template>
  <section class="card">
    <header>
      <h2>{{ title }}</h2>
      <input v-model="filter" placeholder="Filter" />
    </header>
    <table>
      <thead>
        <tr>
          <th>IRI</th>
          <th
            v-for="checkpoint in checkpoints"
            :key="checkpoint.id"
            class="number"
          >
            {{ checkpoint.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.iri">
          <td :title="row.iri">{{ compact(row.iri) }}</td>
          <td v-for="(count, index) in row.counts" :key="index" class="number">
            {{ count?.toLocaleString() ?? '–' }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
