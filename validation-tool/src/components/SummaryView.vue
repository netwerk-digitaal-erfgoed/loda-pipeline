<script setup lang="ts">
import CountsTable from './CountsTable.vue';
import type {Checkpoint} from '../types.ts';

defineProps<{checkpoints: Checkpoint[]}>();
</script>

<template>
  <section
    v-if="checkpoints.every(checkpoint => !checkpoint.counts)"
    class="card"
  >
    <header>
      <h2>Summary</h2>
    </header>
    <p class="hint">No data to summarize yet. Run the pipeline first.</p>
  </section>
  <template v-else>
    <section class="card">
      <header>
        <h2>Triples</h2>
      </header>
      <table>
        <thead>
          <tr>
            <th></th>
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
          <tr>
            <td>Triples</td>
            <td
              v-for="checkpoint in checkpoints"
              :key="checkpoint.id"
              class="number"
            >
              {{ checkpoint.counts?.triples.toLocaleString() ?? '–' }}
            </td>
          </tr>
          <tr>
            <td>Duplicates</td>
            <td
              v-for="checkpoint in checkpoints"
              :key="checkpoint.id"
              class="number"
            >
              {{ checkpoint.counts?.duplicates?.toLocaleString() ?? '–' }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <div class="counts">
      <CountsTable
        title="Classes"
        :checkpoints="checkpoints"
        :select="counts => counts.classes"
      />
      <CountsTable
        title="Properties"
        :checkpoints="checkpoints"
        :select="counts => counts.properties"
      />
    </div>
  </template>
</template>
