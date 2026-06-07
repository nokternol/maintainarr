import type { Request, Response } from 'express';
import { FILTER_REGISTRY } from '../../utils/filterRegistry';
import type { ContentType } from '../../utils/filterRegistry';

export function getFilterFields(req: Request, res: Response): void {
  const { contentType } = req.query;

  if (contentType !== undefined) {
    if (contentType !== 'movie' && contentType !== 'show') {
      res.status(400).json({ error: `Invalid contentType: must be 'movie' or 'show'` });
      return;
    }
    const ct = contentType as ContentType;
    const fields = FILTER_REGISTRY.filter((d) => d.contentTypes.includes(ct)).map((d) => ({
      key: d.key,
      label: d.label,
      dataType: d.dataType,
      contentTypes: d.contentTypes,
    }));
    res.json(fields);
    return;
  }

  const fields = FILTER_REGISTRY.map((d) => ({
    key: d.key,
    label: d.label,
    dataType: d.dataType,
    contentTypes: d.contentTypes,
  }));
  res.json(fields);
}
