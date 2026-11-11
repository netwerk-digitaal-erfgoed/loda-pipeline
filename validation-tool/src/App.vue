<script setup lang="ts">
import {onMounted, ref, watch} from 'vue';
import CountsTable from './components/CountsTable.vue';
import RecordsView from './components/RecordsView.vue';
import ReportCard from './components/ReportCard.vue';
import type {Pipeline, PipelineDetails} from './types.ts';

/** The class of the records each checkpoint describes. */
const recordClasses: Record<string, string> = {
  source: 'https://schema.org/CreativeWork',
  'nde-schema-ap': 'https://schema.org/CreativeWork',
  edm: 'http://www.europeana.eu/schemas/edm/ProvidedCHO',
};

const params = new URLSearchParams(location.search);
const pipelines = ref<Pipeline[]>([]);
const selected = ref(params.get('pipeline') ?? '');
const view = ref<'validation' | 'records'>(params.get('view') === 'records' ? 'records' : 'validation');
const details = ref<PipelineDetails>();
const loading = ref(false);
const error = ref<string>();

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body as T;
}

function updateUrl() {
  history.replaceState(
    null,
    '',
    `?pipeline=${encodeURIComponent(selected.value)}&view=${view.value}`,
  );
}

async function load() {
  if (!selected.value) return;
  updateUrl();
  loading.value = true;
  error.value = undefined;
  try {
    details.value = await get<PipelineDetails>(`/api/pipelines/${encodeURIComponent(selected.value)}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  pipelines.value = await get<Pipeline[]>('/api/pipelines');
  if (!selected.value) selected.value = pipelines.value[0]?.name ?? '';
  else await load();
});
watch(selected, load);
watch(view, updateUrl);
</script>

<template>
  <header class="top">
    <h1>LODA validation</h1>
    <select v-model="selected">
      <option v-for="pipeline in pipelines" :key="pipeline.name" :value="pipeline.name">
        {{ pipeline.name }}
      </option>
    </select>
    <nav class="tabs">
      <button :class="{active: view === 'validation'}" @click="view = 'validation'">Validation</button>
      <button :class="{active: view === 'records'}" @click="view = 'records'">Records</button>
    </nav>
    <button :disabled="loading" @click="load">Reload</button>
    <span v-if="loading">Loading…</span>
    <span v-if="error" class="fail">{{ error }}</span>
    <a v-if="details" :href="details.datasetUri" target="_blank" class="dataset">{{ details.datasetUri }}</a>
  </header>

  <main v-if="view === 'records' && selected">
    <RecordsView :pipeline="selected" />
  </main>

  <main v-else-if="details">
    <div class="reports">
      <ReportCard
        v-for="checkpoint in details.checkpoints"
        :key="checkpoint.id"
        :checkpoint="checkpoint"
        :record-class="recordClasses[checkpoint.id]"
      />
    </div>
    <div class="counts">
      <CountsTable title="Classes" :checkpoints="details.checkpoints" :select="counts => counts.classes" />
      <CountsTable title="Properties" :checkpoints="details.checkpoints" :select="counts => counts.properties" />
    </div>
  </main>
</template>
