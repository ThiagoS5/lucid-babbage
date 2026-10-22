export interface GmCompletionRequest {
  systemInstruction: string;
  prompt: string;
  /** Schema estruturado do turno (o adaptador decide como aplicá-lo). */
  jsonSchema: Record<string, unknown>;
  temperature: number;
}

export interface GmProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  /** Turno completo (não-streaming). Retorna o JSON bruto como texto. */
  completeTurn(req: GmCompletionRequest): Promise<string>;
  /** Turno em streaming. onChunk recebe trechos do JSON bruto; resolve com o texto completo. */
  streamTurn(req: GmCompletionRequest, onChunk: (delta: string) => void): Promise<string>;
  /** Ping de validação de chave/conexão. */
  validate(): Promise<{ ok: boolean; message: string }>;
}
