"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Save, Zap, RefreshCw } from "lucide-react";

interface WorkflowEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: { index: number; type: string; config: Record<string, unknown> };
  onSave: (index: number, type: string, config: Record<string, unknown>) => void;
  actionTypes: string[];
}

export function WorkflowEditorDrawer({ 
  open, 
  onOpenChange, 
  action, 
  onSave, 
  actionTypes = ["create_mission", "create_task", "invoke_agent", "call_tool", "call_api", "send_webhook", "write_memory", "notify_user"] 
}: WorkflowEditorDrawerProps) {
  const [type, setType] = useState(action?.type || "create_mission");
  const [config, setConfig] = useState<Record<string, unknown>>(action?.config || {});

  const handleSave = () => {
    if (action) {
      onSave(action.index, type, config);
    }
    onOpenChange(false);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-96 max-w-[90vw]">
        <DrawerHeader className="flex items-center justify-between p-4 border-b">
          <DrawerTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Edit Action
          </DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Action Type</label>
            <select 
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm h-10"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                "create_mission", "create_task", "invoke_agent", 
                "call_tool", "call_api", "send_webhook", 
                "write_memory", "notify_user"
              ].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {type === "create_mission" && (
              <div>
                <label className="text-sm font-medium">Goal</label>
                <Textarea
                  className="mt-2 min-h-[80px]"
                  value={(config.goal as string) || ""}
                  onChange={(e) => handleConfigChange("goal", e.target.value)}
                  placeholder="What should this mission accomplish?"
                />
              </div>
            )}
            
            {type === "notify_user" && (
              <div>
                <label className="text-sm font-medium">Message</label>
                <Input
                  className="mt-2"
                  value={(config.message as string) || ""}
                  onChange={(e) => handleConfigChange("message", e.target.value)}
                  placeholder="Notification message"
                />
                <select className="mt-2 rounded-md border bg-background px-3 py-2 text-sm h-10"
                  value={(config.severity as string) || "info"}
                  onChange={(e) => handleConfigChange("severity", e.target.value)}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
            )}

            {type === "send_webhook" && (
              <div>
                <label className="text-sm font-medium">URL</label>
                <Input
                  className="mt-2"
                  value={(config.url as string) || ""}
                  onChange={(e) => handleConfigChange("url", e.target.value)}
                  placeholder="https://webhook.example.com"
                />
                <select className="mt-2 rounded-md border bg-background px-3 py-2 text-sm h-10"
                  value={(config.method as string) || "POST"}
                  onChange={(e) => handleConfigChange("method", e.target.value)}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            )}

            {type === "create_task" && (
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  className="mt-2"
                  value={(config.description as string) || ""}
                  onChange={(e) => handleConfigChange("description", e.target.value)}
                />
                <Input 
                  className="mt-2"
                  value={(config.missionId as string) || ""}
                  onChange={(e) => handleConfigChange("missionId", e.target.value)}
                  placeholder="Mission ID"
                />
              </div>
            )}

            {type === "call_tool" && (
              <div>
                <label className="text-sm font-medium">Tool ID</label>
                <Input
                  className="mt-2"
                  value={(config.toolId as string) || ""}
                  onChange={(e) => handleConfigChange("toolId", e.target.value)}
                />
                <label className="text-sm font-medium mt-3">Agent ID</label>
                <Input
                  className="mt-2"
                  value={(config.agentId as string) || ""}
                  onChange={(e) => handleConfigChange("agentId", e.target.value)}
                />
              </div>
            )}

            {type === "call_api" && (
              <div>
                <label className="text-sm font-medium">Connector ID</label>
                <Input
                  className="mt-2"
                  value={(config.connectorId as string) || ""}
                  onChange={(e) => handleConfigChange("connectorId", e.target.value)}
                />
                <Input className="mt-2"
                  value={(config.path as string) || ""}
                  onChange={(e) => handleConfigChange("path", e.target.value)}
                  placeholder="/api/endpoint"
                />
                <select className="mt-2 rounded-md border bg-background px-3 py-2 text-sm h-10"
                  value={(config.method as string) || "GET"}
                  onChange={(e) => handleConfigChange("method", e.target.value)}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            )}

            {type === "write_memory" && (
              <div>
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  className="mt-2 min-h-[80px]"
                  value={(config.content as string) || ""}
                  onChange={(e) => handleConfigChange("content", e.target.value)}
                  placeholder="Memory content"
                />
                <Input className="mt-2"
                  value={(config.scope as string) || "GLOBAL"}
                  onChange={(e) => handleConfigChange("scope", e.target.value)}
                  placeholder="Scope (GLOBAL, USER, MISSION, AGENT, TOOL, TEMP)"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} className="flex-1 gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}