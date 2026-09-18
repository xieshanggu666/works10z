<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { db } from '@/db'
import { makeToken, formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ open: Boolean, doc: Object })
const emit = defineEmits(['close'])
const auth = useAuthStore()

const shares = ref([])
const perm = ref('view')
const baseOrigin = typeof location !== 'undefined' ? location.origin + location.pathname + '#/share/' : '#/share/'

async function load() {
  if (!props.doc) return
  const rows = await db.shares.where('docId').equals(props.doc.id).toArray()
  shares.value = rows.reverse()
}

async function create() {
  const s = { id: 'nodelete-share-' + Date.now().toString(36), docId: props.doc.id, token: makeToken(), permission: perm.value, createdBy: auth.user?.id, expiresAt: null }
  await db.shares.add(s)
  shares.value.unshift(s)
}

async function revoke(id) {
  await db.shares.delete(id)
  shares.value = shares.value.filter((s) => s.id !== id)
}

function copyLink(token) {
  const url = baseOrigin + token
  navigator.clipboard?.writeText(url).then(() => alert('链接已复制。'))
}

async function copyCurrent() {
  await copyLink(props.doc.id)
}

const currentUrl = computed(() => baseOrigin + (props.doc?.id || ''))

function onRootClick() { emit('close') }
function stop(e) { e.stopPropagation() }
onMounted(load)
watch(() => props.open, (v) => { if (v && props.doc) load() })
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="mask" @click.self="onRootClick">
      <div class="dialog" @click="stop">
        <div class="dialog-head">
          <h3>分享「{{ doc?.title }}」</h3>
          <button class="x" @click="emit('close')">✕</button>
        </div>

        <div class="sec">
          <div class="sec-label">当前页面链接</div>
          <div class="url-row">
            <code class="url">{{ currentUrl }}</code>
            <button class="btn sm" @click="copyCurrent">复制</button>
          </div>
          <div class="hint">可见性：{{ doc?.visibility === 'public' ? '公开，所有人可看' : doc?.visibility === 'team' ? '团队，登录成员可看' : '私有，仅授权成员' }}</div>
        </div>

        <div class="sec">
          <div class="sec-label">生成共享链接</div>
          <div class="create-row">
            <select v-model="perm" class="perm">
              <option value="view">仅查看</option>
              <option value="edit">可编辑</option>
            </select>
            <button class="btn primary sm" @click="create">生成链接</button>
          </div>
          <div v-if="shares.length" class="share-list">
            <div v-for="s in shares" :key="s.id" class="share-item">
              <div class="share-info">
                <div class="surl"><code>{{ baseOrigin }}{{ s.token }}</code></div>
                <div class="smeta">{{ s.permission === 'edit' ? '可编辑' : '仅查看' }} · 由 {{ s.createdBy }} 创建 · {{ formatDate(s.createdAt) }}</div>
              </div>
              <button class="btn sm" @click="copyLink(s.token)">复制</button>
              <button class="btn sm danger" @click="revoke(s.id)">撤销</button>
            </div>
          </div>
          <div v-else class="hint">尚未生成共享链接</div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(15, 20, 30, 0.45); display: grid; place-items: center; z-index: 100; }
.dialog { width: 520px; max-width: 92vw; background: #fff; border-radius: 14px; padding: 20px 24px; box-shadow: var(--shadow); }
.dialog-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.dialog-head h3 { margin: 0; }
.x { border: none; background: transparent; font-size: 16px; cursor: pointer; color: var(--text-3); }
.sec { margin-bottom: 18px; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.url-row { display: flex; gap: 8px; align-items: center; }
.url { flex: 1; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { color: var(--text-3); font-size: 12px; margin-top: 6px; }
.create-row { display: flex; gap: 8px; }
.perm { border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 13px; }
.share-list { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.share-item { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
.share-info { flex: 1; min-width: 0; }
.surl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.surl code { font-size: 12px; }
.smeta { color: var(--text-3); font-size: 11px; margin-top: 2px; }
</style>