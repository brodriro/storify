export class AgentResponseDto {
  type: 'action' | 'final';
  action: string | null;
  params: { [key: string]: any } | null;
  message: string | null;
}
