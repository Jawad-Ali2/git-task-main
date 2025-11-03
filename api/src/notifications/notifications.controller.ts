import { Controller, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * SSE endpoint for real-time notifications
   * Frontend connects to this endpoint and receives live updates
   */
  @Get('stream')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ 
    summary: 'SSE stream for real-time notifications',
    description: 'Server-Sent Events endpoint that streams real-time notifications to authenticated users. Keep this connection open to receive live updates.'
  })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiExcludeEndpoint() // Exclude from Swagger UI since SSE doesn't work well in Swagger
  async stream(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    const userId = user.userId;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    this.logger.log(`📡 SSE connection established for user ${userId}`);

    // Send initial connection success message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to notification stream' })}\n\n`);

    // Subscribe to notifications for this user
    const unsubscribe = await this.notificationsService.subscribe(userId, (notification) => {
      // Send notification to client via SSE
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    });

    // Handle client disconnect
    req.on('close', async () => {
      this.logger.log(`🔌 SSE connection closed for user ${userId}`);
      await unsubscribe();
      res.end();
    });

    // Keep connection alive with heartbeat (every 30 seconds)
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check for notification service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
