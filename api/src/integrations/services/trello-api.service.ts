import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  desc: string;
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
  pos: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  idList: string;
  idBoard: string;
  labels: Array<{ id: string; name: string; color: string }>;
  due?: string;
  pos: number;
}

export interface CreateCardParams {
  name: string;
  desc: string;
  idList: string;
  pos?: string;
  due?: string;
  idLabels?: string[];
  urlSource?: string;
}

export interface UpdateCardParams {
  name?: string;
  desc?: string;
  idList?: string;
  pos?: string;
  due?: string;
  closed?: boolean;
}

@Injectable()
export class TrelloApiService {
  private readonly logger = new Logger(TrelloApiService.name);
  private readonly baseUrl = 'https://api.trello.com/1';

  private getErrorSummary(error: any): string {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const message =
      typeof data === 'string'
        ? data
        : data?.message || error?.message || 'Unknown Trello API error';

    return status ? `${status} ${message}` : message;
  }

  /**
   * Create axios instance with Trello authentication
   */
  private createClient(apiKey: string, token: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      params: {
        key: apiKey,
        token: token,
      },
    });
  }

  /**
   * Get user's Trello boards
   */
  async getBoards(apiKey: string, token: string): Promise<TrelloBoard[]> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.get('/members/me/boards', {
        params: {
          filter: 'open',
          fields: 'id,name,url,desc',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch Trello boards: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to fetch Trello boards',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get open cards in a Trello board
   */
  async getBoardCards(
    apiKey: string,
    token: string,
    boardId: string,
  ): Promise<TrelloCard[]> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.get(`/boards/${boardId}/cards`, {
        params: {
          filter: 'open',
          fields: 'id,name,desc,url,idList,idBoard,labels,due,pos',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch Trello board cards: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to fetch Trello board cards',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get lists in a Trello board
   */
  async getLists(
    apiKey: string,
    token: string,
    boardId: string,
  ): Promise<TrelloList[]> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.get(`/boards/${boardId}/lists`, {
        params: {
          filter: 'open',
          fields: 'id,name,idBoard,pos',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch Trello lists: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to fetch Trello lists',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a new Trello card
   */
  async createCard(
    apiKey: string,
    token: string,
    params: CreateCardParams,
  ): Promise<TrelloCard> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.post('/cards', null, {
        params: {
          ...params,
          key: apiKey,
          token: token,
        },
      });
      
      this.logger.log(`Created Trello card: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create Trello card: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to create Trello card',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Update an existing Trello card
   */
  async updateCard(
    apiKey: string,
    token: string,
    cardId: string,
    params: UpdateCardParams,
  ): Promise<TrelloCard> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.put(`/cards/${cardId}`, null, {
        params: {
          ...params,
          key: apiKey,
          token: token,
        },
      });
      
      this.logger.log(`Updated Trello card: ${cardId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update Trello card: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to update Trello card',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get a Trello card by ID
   */
  async getCard(
    apiKey: string,
    token: string,
    cardId: string,
  ): Promise<TrelloCard> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.get(`/cards/${cardId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch Trello card: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to fetch Trello card',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a Trello card
   */
  async deleteCard(apiKey: string, token: string, cardId: string): Promise<void> {
    try {
      const client = this.createClient(apiKey, token);
      await client.delete(`/cards/${cardId}`);
      this.logger.log(`Deleted Trello card: ${cardId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Trello card: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to delete Trello card',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Move a card to a different list
   */
  async moveCard(
    apiKey: string,
    token: string,
    cardId: string,
    targetListId: string,
  ): Promise<TrelloCard> {
    return this.updateCard(apiKey, token, cardId, { idList: targetListId });
  }

  /**
   * Archive (close) a card
   */
  async archiveCard(
    apiKey: string,
    token: string,
    cardId: string,
  ): Promise<TrelloCard> {
    return this.updateCard(apiKey, token, cardId, { closed: true });
  }

  /**
   * Create a webhook for a board (for bi-directional sync)
   */
  async createWebhook(
    apiKey: string,
    token: string,
    boardId: string,
    callbackUrl: string,
  ): Promise<{ id: string; idModel: string; callbackURL: string }> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.post('/webhooks', null, {
        params: {
          key: apiKey,
          token: token,
          callbackURL: callbackUrl,
          idModel: boardId,
          description: 'GitTask Trello Integration',
        },
      });
      
      this.logger.log(`Created Trello webhook: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create Trello webhook: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to create Trello webhook',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(apiKey: string, token: string, webhookId: string): Promise<void> {
    try {
      const client = this.createClient(apiKey, token);
      await client.delete(`/webhooks/${webhookId}`);
      this.logger.log(`Deleted Trello webhook: ${webhookId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Trello webhook: ${this.getErrorSummary(error)}`);
      // Don't throw - webhook might already be deleted
    }
  }

  /**
   * Get member information (for validation)
   */
  async getMemberInfo(apiKey: string, token: string): Promise<any> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.get('/members/me', {
        params: {
          fields: 'id,username,fullName,email',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch Trello member info: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Invalid Trello credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Create a new Trello board
   */
  async createBoard(
    apiKey: string,
    token: string,
    name: string,
    description?: string,
  ): Promise<{ id: string; name: string; url: string }> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.post('/boards', null, {
        params: {
          key: apiKey,
          token: token,
          name: name,
          desc: description || `Board for ${name}`,
          defaultLists: false, // We'll create custom lists
          prefs_permissionLevel: 'private',
          prefs_voting: 'disabled',
          prefs_comments: 'members',
          prefs_invitations: 'members',
        },
      });

      this.logger.log(`Created Trello board: ${response.data.id} (${name})`);
      return {
        id: response.data.id,
        name: response.data.name,
        url: response.data.url,
      };
    } catch (error) {
      this.logger.error(`Failed to create Trello board: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to create Trello board',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a list on a Trello board
   */
  async createList(
    apiKey: string,
    token: string,
    boardId: string,
    name: string,
    pos?: string,
  ): Promise<{ id: string; name: string }> {
    try {
      const client = this.createClient(apiKey, token);
      const response = await client.post('/lists', null, {
        params: {
          key: apiKey,
          token: token,
          name: name,
          idBoard: boardId,
          pos: pos || 'bottom',
        },
      });

      this.logger.log(`Created Trello list: ${response.data.id} (${name})`);
      return {
        id: response.data.id,
        name: response.data.name,
      };
    } catch (error) {
      this.logger.error(`Failed to create Trello list: ${this.getErrorSummary(error)}`);
      throw new HttpException(
        'Failed to create Trello list',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
