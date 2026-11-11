<script setup lang="ts">
import {ref, watch} from 'vue';
import type {RecordDescription, RecordSample} from '../types.ts';

const props = defineProps<{pipeline: string}>();

const samples = ref<RecordSample[]>([]);
const record = ref('');
const description = ref<RecordDescription>();
const loading = ref(false);
const error = ref<string>();

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body as T;
}

const base = () => `/api/pipelines/${encodeURIComponent(props.pipeline)}/records`;

async function loadSamples() {
  description.value = undefined;
  samples.value = await get<RecordSample[]>(base());
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
  <section class="card">
    <header>
      <h2>Record</h2>
      <select v-model="record" @change="describe">
        <option v-for="sample in samples" :key="sample.iri" :value="sample.iri">
          {{ sample.iri }}{{ sample.inEdm ? '' : ' (not in EDM)' }}
        </option>
      </select>
      <input v-model="record" class="iri" placeholder="Or paste a record IRI" @keyup.enter="describe" />
      <button :disabled="loading" @click="describe">Show</button>
      <span v-if="loading">Loading…</span>
      <span v-if="error" class="fail">{{ error }}</span>
    </header>
  </section>

  <div v-if="description" class="reports">
    <section v-for="version in description.versions" :key="version.id" class="card">
      <header>
        <h2>{{ version.label }}</h2>
        <span class="shapes">{{ version.triples.toLocaleString() }} triples</span>
      </header>
      <p v-if="version.missing" class="hint">{{ version.missing }}</p>
      <p v-else-if="version.triples === 0" class="hint">The record is not in this data.</p>
      <pre v-else class="turtle">{{ version.turtle }}</pre>
    </section>
  </div>
</template>
