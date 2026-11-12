<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue';
import type {RunStatus} from '../types.ts';

const props = defineProps<{pipeline: string}>();
const emit = defineEmits<{finished: [pipeline: string]}>();

const status = ref<RunStatus | null>(null);
const error = ref<string>();
const showLog = ref(false);
let events: EventSource | undefined;

const running = computed(() => status.value?.state === 'running' || status.value?.state === 'stopping');

onMounted(() => {
  events = new EventSource('/api/run');
  events.onmessage = message => {
    const next: RunStatus | null = JSON.parse(message.data);
    const wasRunning = running.value;
    status.value = next;
    if (wasRunning && next && !running.value) emit('finished', next.pipeline);
  };
});
onUnmounted(() => events?.close());

async function request(method: string, url: string) {
  error.value = undefined;
  const response = await fetch(url, {method});
  if (!response.ok) error.value = (await response.json()).error ?? response.statusText;
}

const start = () => request('POST', `/api/run?pipeline=${encodeURIComponent(props.pipeline)}`);
const stop = () => request('DELETE', '/api/run');

function duration(ms?: number): string {
  return ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`;
}
</script>

<template>
  <section class="card run">
    <header>
      <h2>Run</h2>
      <button v-if="!running" class="primary" @click="start">Run {{ pipeline }}</button>
      <button v-else :disabled="status?.state === 'stopping'" @click="stop">Stop {{ status?.pipeline }}</button>
      <template v-if="status">
        <span :class="{ok: status.state === 'succeeded', fail: ['failed', 'stopped'].includes(status.state)}">
          {{ status.pipeline }}: {{ status.state }}
        </span>
        <span v-if="status.phase && running">· {{ status.phase }}</span>
        <span>· started {{ new Date(status.startedAt).toLocaleTimeString() }}</span>
      </template>
      <span v-if="error" class="fail">{{ error }}</span>
    </header>

    <template v-if="status">
      <p v-for="message in status.errors" :key="message" class="fail">{{ message }}</p>

      <table v-if="status.stages.length">
        <thead>
          <tr>
            <th>Stage</th>
            <th>State</th>
            <th class="number">Items</th>
            <th class="number">Quads</th>
            <th class="number">Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stage in status.stages" :key="stage.name">
            <td>{{ stage.name }}</td>
            <td :class="{ok: stage.state === 'complete', fail: stage.state === 'failed'}">
              {{ stage.state }}<template v-if="stage.message">: {{ stage.message }}</template>
            </td>
            <td class="number">{{ stage.itemsProcessed.toLocaleString() }}</td>
            <td class="number">{{ stage.quadsGenerated.toLocaleString() }}</td>
            <td class="number">{{ duration(stage.durationMs) }}</td>
          </tr>
        </tbody>
      </table>

      <p v-for="(validation, index) in status.validations" :key="index">
        Validated {{ validation.quadsValidated.toLocaleString() }} quads:
        <span :class="validation.conforms ? 'ok' : 'fail'">
          {{ validation.conforms ? 'conforms' : `${validation.violations.toLocaleString()} violations` }}
        </span>
        <template v-if="validation.message"> · {{ validation.message }}</template>
      </p>

      <button v-if="status.log.length" @click="showLog = !showLog">
        {{ showLog ? 'Hide' : 'Show' }} log
      </button>
      <pre v-if="showLog" class="run-log">{{ status.log.join('\n') }}</pre>
    </template>
  </section>
</template>
