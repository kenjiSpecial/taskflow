import { signal, computed } from "@preact/signals";
import type { Tag, CreateTagInput, UpdateTagInput } from "../lib/api";
import * as api from "../lib/api";

export const tags = signal<Tag[]>([]);
export const loading = signal(false);
export const error = signal<string | null>(null);

/** ハッシュURL内のクエリパラメータを取得 */
function getHashParams(): URLSearchParams {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex) : "");
}

/** ハッシュURL内のクエリパラメータを更新（replaceStateで履歴を汚さない） */
function setHashParam(key: string, value: string | null) {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex) : "");
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const qs = params.toString();
  const newHash = qs ? `${path}?${qs}` : path;
  history.replaceState(null, "", newHash);
}

/** MatrixHeaderでのフィルタ用。nullなら全表示。URL初期値から復元 */
export const selectedTagId = signal<string | null>(getHashParams().get("tag"));

/** タグを選択しURLも同期する */
export function selectTag(tagId: string | null) {
  selectedTagId.value = tagId;
  setHashParam("tag", tagId);
}

export const presetTags = computed(() =>
  tags.value.filter((t) => t.is_preset),
);

export const customTags = computed(() =>
  tags.value.filter((t) => !t.is_preset),
);

export async function loadTags() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.fetchTags();
    tags.value = res.tags;
    // URLのタグIDが存在しない場合はリセット
    if (selectedTagId.value && !res.tags.some((t) => t.id === selectedTagId.value)) {
      selectTag(null);
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

export async function addTag(data: CreateTagInput) {
  const res = await api.createTag(data);
  tags.value = [...tags.value, res.tag];
  return res.tag;
}

export async function editTag(id: string, data: UpdateTagInput) {
  const res = await api.updateTag(id, data);
  tags.value = tags.value.map((t) => (t.id === id ? res.tag : t));
}

export async function removeTag(id: string) {
  await api.deleteTag(id);
  tags.value = tags.value.filter((t) => t.id !== id);
}

// --- Project-Tag linking ---

export async function linkProjectTag(projectId: string, tagId: string) {
  await api.linkProjectTag(projectId, tagId);
}

export async function unlinkProjectTag(projectId: string, tagId: string) {
  await api.unlinkProjectTag(projectId, tagId);
}

// --- Todo-Tag linking ---

export async function linkTodoTag(todoId: string, tagId: string) {
  await api.linkTodoTag(todoId, tagId);
}

export async function unlinkTodoTag(todoId: string, tagId: string) {
  await api.unlinkTodoTag(todoId, tagId);
}
