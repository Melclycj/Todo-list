import { useState, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Hash, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTopics, useCreateTopic, useRenameTopic, useDeleteTopic } from '@/hooks/useTopics'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const MAX_TOPICS = 10

interface SidebarTopicListProps {
  onNavigate?: () => void
}

export function SidebarTopicList({ onNavigate }: SidebarTopicListProps) {
  const { data: topics = [] } = useTopics()
  const { mutate: createTopic } = useCreateTopic()
  const { mutate: renameTopic } = useRenameTopic()
  const { mutate: deleteTopic } = useDeleteTopic()

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createTopic({ name }, { onSettled: () => { setIsCreating(false); setNewName('') } })
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!renamingId) return
    const name = renameValue.trim()
    if (!name) return
    renameTopic(
      { id: renamingId, payload: { name } },
      { onSettled: () => setRenamingId(null) }
    )
  }

  function handleDelete(id: string) {
    deleteTopic(id, { onSettled: () => setDeletingId(null) })
  }

  const deletingTopic = topics.find((t) => t.id === deletingId)

  return (
    <div>
      {topics.map((topic) => (
        <div key={topic.id} className="group relative">
          {renamingId === topic.id ? (
            <form onSubmit={handleRenameSubmit} className="px-2 py-0.5">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => { if (e.key === 'Escape') setRenamingId(null) }}
                className="w-full text-sm bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </form>
          ) : (
            <NavLink
              to={`/topics/${topic.id}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium border-l-2 border-primary rounded-l-none'
                    : 'text-foreground hover:bg-muted'
                )
              }
            >
              <Hash size={13} className="flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{topic.name}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-border transition-opacity"
                  >
                    <MoreHorizontal size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => startRename(topic.id, topic.name)}>
                    <Pencil size={13} className="mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeletingId(topic.id)}
                  >
                    <Trash2 size={13} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </NavLink>
          )}
        </div>
      ))}

      {/* Inline create form */}
      {topics.length >= MAX_TOPICS ? (
        <p className="px-3 py-1.5 text-xs text-muted-foreground">
          Maximum of {MAX_TOPICS} topics reached
        </p>
      ) : isCreating ? (
        <form onSubmit={handleCreateSubmit} className="px-2 py-0.5">
          <input
            ref={newInputRef}
            autoFocus
            placeholder="Topic name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { setIsCreating(false); setNewName('') }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setIsCreating(false); setNewName('') } }}
            className="w-full text-sm bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <Plus size={13} />
          Add topic
        </button>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete topic?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{deletingTopic?.name}</span>? Tasks will keep their content.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
