import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const authDataSerialized = await AsyncStorage.getItem('userData');
      const token = await AsyncStorage.getItem('userToken');
      if (authDataSerialized) {
        const authData = JSON.parse(authDataSerialized);
        
        // Mobile app is strictly for Teachers and Students. Purge any cached Admin tokens.
        if (authData?.role === 'admin') {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userData');
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(authData);

        if (token && authData?.role && authData.role !== 'admin') {
          const endpoint = authData.role === 'student' ? '/students/me' : '/teachers/me';
          apiClient.get(endpoint).then(res => {
            if (res.data) {
              const freshUser = { ...authData, ...res.data };
              setUser(freshUser);
              AsyncStorage.setItem('userData', JSON.stringify(freshUser));
            }
          }).catch(e => console.warn('Failed to refresh profile:', e));
        }
      }
    } catch (error) {
      console.warn('Load storage error:', error);
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (email, password, role = 'student', organization_id) => {
    try {
      let endpoint = '/auth/login';
      if (role === 'admin') endpoint = '/auth/admin/login';
      if (role === 'student') endpoint = '/auth/student/login';

      const response = await apiClient.post(endpoint, { email, password, role, organization_id });
      const { token, user: userData } = response.data;

      const fullUserData = { ...userData, token };
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(fullUserData));
      
      setUser(fullUserData);
      return { success: true };
    } catch (error) {
      console.log('Login Error:', error.response?.data || error.message);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed - please try again' 
      };
    }
  };

  const signInWithGoogle = async (idToken, role = 'student', organization_id) => {
    try {
      const response = await apiClient.post('/auth/firebase-login', { 
        idToken, 
        role, 
        organization_id,
        platform: 'mobile' 
      });
      const { token, user: userData } = response.data;

      const fullUserData = { ...userData, token };
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(fullUserData));
      
      setUser(fullUserData);
      return { success: true };
    } catch (error) {
      console.log('Google Login Error:', error.response?.data || error.message);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Google Login failed - please try again' 
      };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
