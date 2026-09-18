<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/db'
import { useKbStore } from '@/stores/kb'
import { useAuthStore } from '@/stores/auth'
import DocPill from '@/components/common/DocPill.vue'
import RichEditor from '@/components/doc/RichEditor.vue'
import { formatFull } from '@/utils/format'
import { shareState, shareAllows } from '@/utils/permission'

const route = useRoute()
const kb = useKbStore()
const auth = useAuthStore()

const share = ref(null)
const doc = ref(null)
const status = ref('loading') // loading | notfound | revoked | expired | ok

const editing = ref(false)
const editBody = ref('')
const saving = ref(false)
const saveMsg = ref('')

const token = computed(() => route.params.token)
const userById = computed(() => Object.fromEntries(auth.users.map((u) => [u.id, u])))
// 链接授予的权限与页面能力保持一致：仅有效的 edit 链接可进入编辑
const canEditViaShare = computed(() => shareAllows(share.value, 'edit'))

async function resolve(tokenVal) {
  status.value = 'loading'
  share.value = null
  doc.value = null
  editing.value = false
  const s = await db.shares.where('token').equals(tokenVal).first()
  // 统一状态判定：链接状态即访问权限
  const st = shareState(s)
  if (st === 'invalid') { status.value = 'notfound'; return }
  if (st === 'revoked') { status.value = 'revoked'; return }
  if (st === 'expired') { status.value = 'expired'; return }
  const d = await kb.getDoc(s.docId)
  if (!d) { status.value = 'notfound'; return }
  share.value = s
  doc.value = d
  status.value = 'ok'
}

function startEdit() {
  if (!canEditViaShare.value || !doc.value) return
  editBody.value = doc.value.body
  editing.value = true
}

async function saveEdit() {
  // 保存前再次校验链接状态，防止编辑期间链接被撤销或过期
  if (!canEditViaShare.value) {
    alert('该共享链接已失效（被撤销或过期），无法保存。')
    await resolve(token.value)
    return
  }
  saving.value = true
  const updated = await kb.updateDoc(doc.value.id, { body: editBody.value }, auth.user, '通过共享链接编辑')
  saving.value = false
  if (updated) {
    doc.value = updated
    editing.value = false
    saveMsg.value = '已保存 ✓'
    setTimeout(() => { saveMsg.value = '' }, 2000)
  }
}

onMounted(() => resolve(token.value))
watch(token, () => resolve(token.value))
</script>

<template>
  <div class="share">
    <div v-if="status === 'loading'" class="empty card"><div class="ico">⏳</div>正在加载共享文档…</div>
    <div v-else-if="status === 'notfound'" class="empty card"><div class="ico">🚫</div>共享链接无效或文档不存在</div>
    <div v-else-if="status === 'revoked'" class="empty card"><div class="ico">⛔</div>该共享链接已被撤销</div>
    <div v-else-if="status === 'expired'" class="empty card"><div class="ico">⏰</div>该共享链接已过期</div>

    <template v-else-if="doc">
      <div class="share-banner card">
        <span>🔗 您正在通过共享链接{{ share.permission === 'edit' ? '查看并编辑' : '查看' }}此文档（{{ share.permission === 'edit' ? '可编辑' : '只读' }}）</span>
        <span class="owner">由 {{ userById[share.createdBy]?.name || share.createdBy }} 分享</span>
      </div>

      <div class="page-head card">
        <h1 class="title">{{ doc.title }}</h1>
        <div class="sub">
          <DocPill :doc="doc" />
          <span>更新于 {{ formatFull(doc.updatedAt) }}</span>
        </div>
      </div>

      <article v-if="!editing" class="render card" v-html="doc.body"></article>
      <div v-else class="edit-wrap card">
        <RichEditor v-model="editBody" />
        <div class="edit-actions">
          <button class="btn" :disabled="saving" @click="editing = false">取消</button>
          <button class="btn primary" :disabled="saving" @click="saveEdit">{{ saving ? '保存中…' : '保存变更' }}</button>
        </div>
      </div>

      <div class="foot card">
        <span class="link-label">以访客身份{{ share.permission === 'edit' ? '编辑' : '阅读' }}</span>
        <div class="foot-actions">
          <span class="saved">{{ saveMsg }}</span>
          <button v-if="canEditViaShare && !editing" class="btn" @click="startEdit">✎ 编辑文档</button>
          <a class="btn" href="#/">前往知识库首页 →</a>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.share { padding: 20px 0; }
.share-banner { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; background: var(--primary-weak); border-color: var(--primary); color: var(--primary); font-weight: 500; }
.owner { font-weight: 400; font-size: 12px; opacity: 0.8; }
.page-head { padding: 20px 24px; margin-bottom: 14px; }
.title { margin: 0 0 10px; }
.sub { display: flex; align-items: center; gap: 12px; color: var(--text-3); font-size: 12px; }
.render { padding: 28px 32px; line-height: 1.8; margin-bottom: 14px; }
.render :deep(h1) { font-size: 26px; } .render :deep(h2) { font-size: 21px; }
.render :deep(pre) { background: #1f2733; color: #dff2ff; padding: 12px 14px; border-radius: 8px; overflow: auto; }
.render :deep(blockquote) { border-left: 3px solid var(--primary); margin: 8px 0; padding: 4px 12px; color: var(--text-2); background: var(--primary-weak); }
.render :deep(img) { max-width: 100%; }
.edit-wrap { margin-bottom: 14px; overflow: hidden; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); }
.foot { padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
.link-label { color: var(--text-3); font-size: 13px; }
.foot-actions { display: flex; align-items: center; gap: 10px; }
.saved { color: var(--accent); font-size: 12px; }
</style>
