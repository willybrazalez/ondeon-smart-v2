import axios from 'axios';
import logger from '../lib/logger.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const audioService = {
  async getPlaylist(playlistId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/playlists/${playlistId}`);
      return response.data;
    } catch (error) {
      logger.error('Error al obtener la playlist:', error);
      throw error;
    }
  },

  async getNextTrack(playlistId, currentTrackId = null) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/playlists/${playlistId}/next`, {
        params: { currentTrackId }
      });
      return response.data;
    } catch (error) {
      logger.error('Error al obtener la siguiente pista:', error);
      throw error;
    }
  },

  async getTrackUrl(trackId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tracks/${trackId}/url`);
      return response.data.url;
    } catch (error) {
      logger.error('Error al obtener la URL de la pista:', error);
      throw error;
    }
  }
};

export default audioService; 