<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/db'
import { useKbStore } from '@/stores/kb'
import { useAuthStore } from '@/stores/auth'
import DocPill from '@/components/common/DocPill.vue'
import { formatFull, avatarColor } from '@/utils/format'

const route = useRoute()
const kb = useKbStore()
const auth = useAuthStore()

const share = ref(null)
const doc = ref(null)
const status = ref('loading')

const token = computed(() => route.params.token)
const userById = computed(() => Object.fromEntries(auth.users.map((u) => [u.id, u])))

async function resolve(tokenVal) {
  status.value = 'loading'
  share.value = null
  doc.value = null
  const s = await db.shares.where('token').equals(tokenVal).first()
  if (!s) { status.value = 'notfound'; return }
  if (s.expiresAt && new Date(s.expiresAt) < new Date()) { status.value = 'expired'; return }
  share.value = s
  const d = await kb.getDoc(s.docId)
  if (!d) { status.value = 'notfound'; return }
  doc.value = d
  status.value = 'ok'
}

onMounted(() => resolve(token.value))
watch(token, () => resolve(token.value))
</script>

<template>
  <div class="share">
    <div v-if="status === 'loading'" class="empty card"><div class="ico">⏳</div>正在加载共享文档…</div>
    <div v-else-if="status === 'notfound'" class="empty card"><div class="ico">🚫</div>共享链接无效或文档不存在</div>
    <div v-else-if="status === 'expired'" class="empty card"><div class="ico">⏰</div>该共享链接已过期</div>

    <template v-else-if="doc">
      <div class="share-banner card">
        <span>🔗 您正在通过共享链接查看「{{ share.permission === 'edit' ? '可编辑' : '只读' }}」副本</span>
        <span class="owner">由 {{ userById[share.createdBy]?.name || share.createdBy }} 分享</span>
      </div>

      <div class="page-head card">
        <h1 class="title">{{ doc.title }}</h1>
        <div class="sub">
          <DocPill :doc="doc" />
          <span>更新于 {{ formatFull(doc.updatedAt) }}</span>
        </div>
      </div>

      <article class="render card" v-html="doc.body"></article>

      <div class="foot card">
        <span class="link-label">以访客身份阅读</span>
        <a class="btn" href="#/">前往知识库首页 →</a>
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
.foot { padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
.link-label { color: var(--text-3); font-size: 13px; }
</style>