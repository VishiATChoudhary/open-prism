import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { Provider } from '@shared/types'
import { useProject } from '@/state/useProject'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function SettingsDialog() {
  const settings = useProject((s) => s.settings)
  const setSettings = useProject((s) => s.setSettings)
  const [open, setOpen] = useState(false)

  function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    void window.api.setSettings(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">AI provider</label>
            <Select value={settings.provider} onValueChange={(v) => update({ provider: v as Provider })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">Claude (claude CLI)</SelectItem>
                <SelectItem value="codex">Codex (codex CLI)</SelectItem>
                <SelectItem value="opencode">Opencode (opencode CLI)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Model (optional)</label>
            <Textarea
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="leave blank for CLI default"
              className="min-h-[40px]"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
