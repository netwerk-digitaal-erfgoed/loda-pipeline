<script setup lang="ts">
import {computed, ref, useTemplateRef} from 'vue';
import type {RecordSample} from '../types.ts';

const props = defineProps<{samples: RecordSample[]}>();
const record = defineModel<string>({required: true});
const emit = defineEmits<{pick: []}>();

const input = useTemplateRef('input');
const open = ref(false);
const active = ref(-1);

/** All samples while the input holds one of them, otherwise the ones that match what is typed. */
const options = computed(() => {
  const needle = record.value.trim().toLowerCase();
  if (!needle || props.samples.some(sample => sample.iri === record.value)) return props.samples;
  return props.samples.filter(sample => sample.iri.toLowerCase().includes(needle));
});

function show() {
  open.value = true;
  active.value = options.value.findIndex(sample => sample.iri === record.value);
}

function toggle() {
  if (document.activeElement !== input.value) input.value?.focus();
  else if (open.value) open.value = false;
  else show();
}

function pick(iri: string) {
  record.value = iri;
  open.value = false;
  emit('pick');
}

function move(step: number) {
  if (!open.value) return show();
  const count = options.value.length;
  if (count) active.value = (active.value + step + count) % count;
}

function enter() {
  const option = open.value ? options.value[active.value] : undefined;
  pick(option?.iri ?? record.value.trim());
}
</script>

<template>
  <div class="combobox" @focusout="open = false">
    <input
      ref="input"
      v-model="record"
      placeholder="Pick or paste a record IRI"
      role="combobox"
      :aria-expanded="open"
      @focus="show"
      @input="open = true; active = -1"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="enter"
      @keydown.esc="open = false"
    />
    <button class="toggle" tabindex="-1" aria-label="Show records" @mousedown.prevent="toggle">
      ▾
    </button>
    <ul v-if="open && options.length" class="options" role="listbox">
      <li
        v-for="(sample, index) in options"
        :key="sample.iri"
        role="option"
        :aria-selected="sample.iri === record"
        :class="{active: index === active, selected: sample.iri === record}"
        @mousedown.prevent="pick(sample.iri)"
        @mouseenter="active = index"
      >
        <span class="iri">{{ sample.iri }}</span>
        <span v-if="!sample.inEdm" class="tag">not in EDM</span>
      </li>
    </ul>
  </div>
</template>
