<script setup lang="ts">
import {onMounted, ref, useTemplateRef} from 'vue';
import {compact} from '../iri.ts';
import type {Checkpoint, RecordDetails} from '../types.ts';
import RecordTriples from './RecordTriples.vue';

const props = defineProps<{
  pipeline: string;
  checkpoint: Pick<Checkpoint, 'id' | 'label'>;
  iri: string;
}>();
const emit = defineEmits<{close: []}>();

const dialog = useTemplateRef('dialog');
const details = ref<RecordDetails>();
const error = ref<string>();

function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close();
}

onMounted(async () => {
  dialog.value?.showModal();
  try {
    const params = new URLSearchParams({iri: props.iri, checkpoint: props.checkpoint.id});
    const response = await fetch(
      `/api/pipelines/${encodeURIComponent(props.pipeline)}/record?${params}`,
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? response.statusText);
    details.value = body;
  } catch (e) {
    error.value = (e as Error).message;
  }
});
</script>

<template>
  <dialog ref="dialog" class="record-dialog" @close="emit('close')" @click="closeOnBackdrop">
    <section class="card">

      <header>
        <h2>{{ checkpoint.label }}</h2>
        <span class="shapes">{{ iri }}</span>
        <button class="close" @click="dialog?.close()">Close</button>
      </header>

      <span v-if="error" class="fail">{{ error }}</span>
      <p v-else-if="!details">Loading…</p>

      <template v-else>
        <h3>Validation results</h3>
        <p v-if="details.results === undefined" class="hint">No validation report.</p>
        <p v-else-if="details.results.length === 0" class="hint">None.</p>
        <table v-else>

          <thead>
            <tr>
              <th>Focus node</th>
              <th>Path</th>
              <th>Message</th>
              <th>Value</th>
            </tr>
          </thead>
          
          <tbody>
            <tr v-for="(result, index) in details.results" :key="index" class="group" :class="result.severity">
              <td>{{ result.focusNode === iri ? '' : result.focusNode.slice(iri.length) }}</td>
              <td>{{ result.path ? compact(result.path) : '' }}</td>
              <td>
                {{ result.message ?? result.constraint }}
                <span class="constraint">{{ result.constraint }}</span>
              </td>
              <td class="value">{{ result.value }}</td>
            </tr>
          </tbody>

        </table>

        <h3>Triples <span class="shapes">{{ details.version.triples.toLocaleString() }}</span></h3>
        <p v-if="details.version.missing" class="hint">{{ details.version.missing }}</p>
        <p v-else-if="details.version.triples === 0" class="hint">The record is not in this data.</p>
        <RecordTriples v-else :version="details.version" />
        
      </template>
    </section>
  </dialog>
</template>
