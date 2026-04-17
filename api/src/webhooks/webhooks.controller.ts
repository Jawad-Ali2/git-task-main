import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { Request } from 'express';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService,
  ) { }

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGithubWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
    @Req() req: Request,
  ) {
    this.logger.log(`Received Github webhook: ${event} (delivery ID: ${deliveryId})`);

    // Get raw body for signature verification
    const rawBody = req['rawBody'] || JSON.stringify(payload);

    // Verify the webhook signature
    if (!this.webhooksService.verifySignature(rawBody, signature)) {
      this.logger.warn(`Invalid signature for delivery ID: ${deliveryId}`);
      throw new UnauthorizedException('Invalid signature');
    }

    // Handle different event types
    try {
      switch (event) {
        case 'push':
          return await this.webhooksService.handlePushEvent(payload);
        case 'installation':
          return await this.webhooksService.handleInstallationEvent(payload);
        case 'installation_repositories':
          return await this.webhooksService.handleInstallationRepositoriesEvent(payload);
        default:
          this.logger.log(`Unhandled event type: ${event}`);
          return { message: 'Event ignored' };
      }
    } catch (error: any) {
      this.logger.error(`Error handling webhook: ${error.message}`);
      throw error;
    }
  }

}
