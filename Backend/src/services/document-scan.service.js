import * as model from '../models/document-scan.model.js';
import { assertUuid, assertText, assertInteger } from '../utils/validation.js';
export const check = id => model.getDocumentCheck(assertUuid(id, 'documentId'));
export const scan = async (id, input, userId) => {
  const documentId = assertUuid(id, 'documentId');
  const event = await model.scanDocumentItem({ documentId, identifier: assertText(input.identifier, 'identifier', 100),
    quantity: assertInteger(input.quantity ?? 1, 'quantity', 1), requestId: assertUuid(input.requestId, 'requestId'), userId });
  return { event, check: await model.getDocumentCheck(documentId) };
};
