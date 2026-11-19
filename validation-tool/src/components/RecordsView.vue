<script setup lang="ts">
import {ref, watch} from 'vue';
import type {RecordDescription, RecordSample, RecordVersion} from '../types.ts';
import RecordDialog from './RecordDialog.vue';
import RecordPicker from './RecordPicker.vue';
import RecordTriples from './RecordTriples.vue';

const props = defineProps<{pipeline: string}>();

const samples = ref<RecordSample[]>();
const record = ref('');
const description = ref<RecordDescription>();
const openVersion = ref<RecordVersion>();
const triplesView = ref<'tree' | 'turtle'>('tree');
const loading = ref(false);
const error = ref<string>();

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body as T;
}

const base = () =>
  `/api/pipelines/${encodeURIComponent(props.pipeline)}/records`;

async function loadSamples() {
  description.value = undefined;
  samples.value = undefined;
  error.value = undefined;
  try {
    samples.value = await get<RecordSample[]>(base());
  } catch (e) {
    error.value = (e as Error).message;
    return;
  }
  record.value = samples.value[0]?.iri ?? '';
  await describe();
}

async function describe() {
  if (!record.value) return;
  loading.value = true;
  error.value = undefined;
  try {
    description.value = await get<RecordDescription>(
      `${base()}?iri=${encodeURIComponent(record.value)}`,
    );
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(() => props.pipeline, loadSamples, {immediate: true});
</script>

<template>
  <section class="card record-picker">
    <header>
      <h2>Record</h2>
      <template v-if="samples?.length">
        <RecordPicker v-model="record" :samples="samples" @pick="describe" />
        <button :disabled="loading" @click="describe">Show</button>
      </template>
      <span v-if="loading || !(samples || error)">Loading…</span>
      <span v-if="error" class="fail">{{ error }}</span>
    </header>
    <p v-if="samples?.length === 0" class="hint">
      No records: there is no SCHEMA-AP-NDE data yet. Run the pipeline first.
    </p>
  </section>

  <div v-if="description" class="reports">
    <section
      v-for="version in description.versions"
      :key="version.id"
      class="card"
    >
      <header>
        <h2>{{ version.label }}</h2>
        <span class="shapes"
          >{{ version.triples.toLocaleString() }} triples</span
        >
        <button class="open" @click="openVersion = version">Open</button>
      </header>
      <p v-if="version.missing" class="hint">{{ version.missing }}</p>
      <p v-else-if="version.triples === 0" class="hint">
        The record is not in this data.
      </p>
      <RecordTriples v-else v-model:view="triplesView" :version="version" />
    </section>
  </div>

  <RecordDialog
    v-if="description && openVersion"
    :pipeline="pipeline"
    :checkpoint="openVersion"
    :iri="description.iri"
    @close="openVersion = undefined"
  />
</template>
