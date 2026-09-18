<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { db } from '@/db'
import { uid, makeToken, formatDate, formatFull } from '@/utils/format'
import { shareState, SHARE_STATE } from '@/utils/permission'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ open: Boolean, doc: Object })
const emit = defineEmits(['close'])
const auth = useAuthStore()

const shares = ref([])
const perm = ref('view')
const expireDays = ref(0) // 0 = 永久有效
const shareBase = typeof location !== 'undefined' ? location.origin + location.pathname + '#/share/' : '#/share/'
const docBase = typeof location !== 'undefined' ? location.origin + location.pathname + '#/docs/' : '#/docs/'

const userById = computed(() => Object.fromEntries(auth.users.map((u) => [u.id, u])))

// 当前页面链接指向文档详情页（#/docs/:id），而非共享令牌链接
const currentUrl = computed(() => docBase + (props.doc?.id || ''))

async function load() {
  if (!props.doc) return
  const rows = await db.shares.where('docId').equals(props.doc.id).toArray()
  shares.value = rows.reverse()
}

async function create() {
  const now = Date.now()
  const s = {
    id: uid('sh'),
    docId: props.doc.id,
    token: makeToken(),
    permission: perm.value,
    createdBy: auth.user?.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: expireDays.value ? new Date(now + expireDays.value * 86400000).toISOString() : null,
    revokedAt: null
  }
  await db.shares.add(s)
  shares.value.unshift(s)
}

// 撤销 = 标记 revokedAt（软撤销），链接状态与文档访问权限同步失效
async function revoke(s) {
  const revokedAt = new Date().toISOString()
  await db.shares.update(s.id, { revokedAt })
  s.revokedAt = revokedAt
}

function stateOf(s) { return shareState(s) }
function stateLabel(s) {
  return { [SHARE_STATE.ACTIVE]: '有效', [SHARE_STATE.REVOKED]: '已撤销', [SHARE_STATE.EXPIRED]: '已过期' }[stateOf(s)] || '无效'
}
function expireText(s) {
  return s.expiresAt ? '有效期至 ' + formatFull(s.expiresAt) : '永久有效'
}

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => alert('链接已复制。'))
}
function copyLink(s) { copy(shareBase + s.token) }
function copyCurrent() { copy(currentUrl.value) }

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
            <select v-model.number="expireDays" class="perm">
              <option :value="0">永久有效</option>
              <option :value="1">1 天后过期</option>
              <option :value="7">7 天后过期</option>
              <option :value="30">30 天后过期</option>
            </select>
            <button class="btn primary sm" @click="create">生成链接</button>
          </div>
          <div v-if="shares.length" class="share-list">
            <div v-for="s in shares" :key="s.id" class="share-item" :class="{ off: stateOf(s) !== 'active' }">
              <div class="share-info">
                <div class="surl"><code>{{ shareBase }}{{ s.token }}</code></div>
                <div class="smeta">
                  <span class="state" :class="stateOf(s)">{{ stateLabel(s) }}</span>
                  {{ s.permission === 'edit' ? '可编辑' : '仅查看' }} · 由 {{ userById[s.createdBy]?.name || s.createdBy || '未知' }} 创建于 {{ formatDate(s.createdAt) }} · {{ expireText(s) }}
                </div>
              </div>
              <button class="btn sm" :disabled="stateOf(s) !== 'active'" @click="copyLink(s)">复制</button>
              <button v-if="stateOf(s) === 'active'" class="btn sm danger" @click="revoke(s)">撤销</button>
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
.share-item.off { opacity: 0.6; }
.share-info { flex: 1; min-width: 0; }
.surl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.surl code { font-size: 12px; }
.smeta { color: var(--text-3); font-size: 11px; margin-top: 2px; }
.state { font-weight: 600; margin-right: 4px; }
.state.active { color: var(--accent); }
.state.revoked { color: var(--danger); }
.state.expired { color: var(--warn); }
</style>