<script setup lang="ts">
import {ref} from 'vue';
import {compact} from '../iri.ts';
import type {Checkpoint, Counts, ResultGroup} from '../types.ts';
import RecordDialog from './RecordDialog.vue';

const props = defineProps<{
  pipeline: string;
  checkpoint: Checkpoint;
  recordClass: string;
}>();

const expanded = ref<ResultGroup>();
/** The record whose dialog is open: the focus node without its fragment, like #cho. */
const openRecord = ref<string>();

function records(counts?: Counts): number | undefined {
  return counts?.classes[props.recordClass];
}

function toggle(group: ResultGroup) {
  expanded.value = expanded.value === group ? undefined : group;
}
</script>

<template>
  <section class="card">
    <header>
      <h2>{{ checkpoint.label }}</h2>
      <span class="shapes">against {{ checkpoint.shapes }}</span>
    </header>

    <p v-if="checkpoint.hint" class="hint">{{ checkpoint.hint }}</p>

    <template v-if="checkpoint.report">
      <dl class="stats">
        <div>
          <dt>Conforms</dt>
          <dd :class="checkpoint.report.conforms ? 'ok' : 'fail'">
            {{ checkpoint.report.conforms ? 'yes' : 'no' }}
          </dd>
        </div>
        <div>
          <dt>Results</dt>
          <dd>{{ checkpoint.report.results.toLocaleString() }}</dd>
        </div>
        <div
          v-for="(count, severity) in checkpoint.report.bySeverity"
          :key="severity"
        >
          <dt>{{ severity }}</dt>
          <dd>{{ count.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>Focus nodes</dt>
          <dd>{{ checkpoint.report.focusNodes.toLocaleString() }}</dd>
        </div>
        <div v-if="records(checkpoint.counts) !== undefined">
          <dt>{{ compact(recordClass) }}</dt>
          <dd>{{ records(checkpoint.counts)!.toLocaleString() }}</dd>
        </div>
        <div v-if="checkpoint.counts">
          <dt>Triples</dt>
          <dd>{{ checkpoint.counts.triples.toLocaleString() }}</dd>
        </div>
        <div v-if="checkpoint.counts?.duplicates !== undefined">
          <dt>Duplicates</dt>
          <dd>{{ checkpoint.counts.duplicates.toLocaleString() }}</dd>
        </div>
      </dl>

      <table v-if="checkpoint.report.groups.length > 0">
        <thead>
          <tr>
            <th class="number">Results</th>
            <th class="number">Nodes</th>
            <th>Path</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="group in checkpoint.report.groups"
            :key="
              [
                group.severity,
                group.path,
                group.constraint,
                group.message,
              ].join()
            "
          >
            <tr class="group" :class="group.severity" @click="toggle(group)">
              <td class="number">{{ group.results.toLocaleString() }}</td>
              <td class="number">{{ group.focusNodes.toLocaleString() }}</td>
              <td>{{ group.path ? compact(group.path) : '' }}</td>
              <td>
                {{ group.message ?? group.constraint }}
                <span class="constraint">{{ group.constraint }}</span>
              </td>
            </tr>
            <tr v-if="expanded === group">
              <td colspan="4">
                <ul class="samples">
                  <li
                    v-for="sample in group.samples"
                    :key="sample.focusNode + sample.value"
                  >
                    <button
                      class="sample"
                      title="Inspect the record"
                      @click="openRecord = sample.focusNode.replace(/#.*$/, '')"
                    >
                      <span class="focus-node">{{ sample.focusNode }}</span>
                      <span v-if="sample.value" class="value">{{
                        sample.value
                      }}</span>
                      <span class="inspect">Inspect</span>
                    </button>
                  </li>
                </ul>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>

    <RecordDialog
      v-if="openRecord"
      :pipeline="pipeline"
      :checkpoint="checkpoint"
      :iri="openRecord"
      @close="openRecord = undefined"
    />
  </section>
</template>
