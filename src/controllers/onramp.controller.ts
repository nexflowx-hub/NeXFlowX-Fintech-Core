import { Request, Response } from 'express';

export class OnrampController {
  static async getQuote(req: Request, res: Response) {
    res.status(501).json({ message: 'Roteamento Onramp em desenvolvimento' });
  }
  static async initiate(req: Request, res: Response) {
    res.status(501).json({ message: 'Roteamento Onramp em desenvolvimento' });
  }
  static async getStatus(req: Request, res: Response) {
    res.status(501).json({ message: 'Roteamento Onramp em desenvolvimento' });
  }
}
