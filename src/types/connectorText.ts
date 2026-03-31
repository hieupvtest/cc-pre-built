// Stub: connectorText was tree-shaken from the source map (internal-only)
export type ConnectorTextBlock = { type: 'connector_text'; text: string }
export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return typeof block === 'object' && block !== null && (block as any).type === 'connector_text';
}
