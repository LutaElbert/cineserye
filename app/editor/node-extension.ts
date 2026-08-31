/**
 * Product-neutral contract for node types supplied by a domain layer.
 *
 * The editor does not import a product registry. A derived product can expose
 * descriptors through this contract, then add rendering and document parsing
 * deliberately when a node type is ready to ship.
 */
export type NodeExtensionDescriptor<TKind extends string, TData> = Readonly<{
  kind: TKind;
  displayName: string;
  schemaVersion: number;
  status: 'planned' | 'active';
  validateData: (value: unknown) => value is TData;
}>;

export function createNodeExtensionCatalog<
  TDescriptor extends NodeExtensionDescriptor<string, unknown>,
>(descriptors: readonly TDescriptor[]) {
  const byKind = new Map<string, TDescriptor>();
  for (const descriptor of descriptors) {
    if (byKind.has(descriptor.kind)) {
      throw new Error(`Duplicate node extension kind: ${descriptor.kind}`);
    }
    byKind.set(descriptor.kind, descriptor);
  }
  return Object.freeze({
    all: Object.freeze([...descriptors]),
    get(kind: string) {
      return byKind.get(kind);
    },
  });
}
