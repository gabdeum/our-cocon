import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { disconnectAssistant, loadAiPermissions, loadAssistants, setAiPermission } from '@cocon/data';
import { AiConnections } from '../../components/settings/AiConnections';
import { aiConnectionsKey } from '../../lib/assistants';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';
import { systemShare } from '../../lib/system-share';
import { config } from '../../lib/tracker';

/** /settings/ai (spec 025, OC-Connect): the member's AI assistants, pushed from Settings › More. */
export default function AiConnectionsRoute() {
  const { state, client, tracker } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();
  const userId = state.status === 'ready' ? state.userId : '';
  const assistants = useQuery({ queryKey: aiConnectionsKey(userId), queryFn: () => loadAssistants(client), enabled: userId !== '' });
  const permissions = useQuery({ queryKey: ['ai_permissions', userId], queryFn: () => loadAiPermissions(client), enabled: userId !== '' });
  if (state.status !== 'ready') return null;
  return (
    <AiConnections
      assistants={assistants.data}
      permissions={permissions.data}
      address={`${config.mcpUrl}/mcp`}
      tracker={tracker}
      failed={assistants.isError || permissions.isError}
      onRetry={() => void Promise.all([assistants.refetch(), permissions.refetch()])}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onCheck={async () => {
        const { data, error } = await assistants.refetch();
        if (error || !data) throw error ?? new Error('No connections');
        return data;
      }}
      onDisconnect={async (clientIds) => {
        const { error } = await disconnectAssistant(client.auth.oauth, clientIds);
        await queryClient.invalidateQueries({ queryKey: aiConnectionsKey(userId) });
        if (error) throw error;
      }}
      onSetPermission={async (permission, allowed) => {
        const { error } = await setAiPermission(client, state.family.id, userId, permission, allowed);
        if (error) throw error;
        await permissions.refetch();
      }}
      onCopy={systemShare.copy}
      readOnly={!online}
    />
  );
}
