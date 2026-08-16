import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  HomeScreen,
  BookmarkDetailsScreen,
  CollectionDetailsScreen,
  ProfileScreen,
} from '../screens';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#0F172A',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: '#F8FAFC',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BookmarkDetails"
        component={BookmarkDetailsScreen}
        options={{
          title: 'Bookmark Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="CollectionDetails"
        component={CollectionDetailsScreen}
        options={{
          title: 'Collection Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile & Database',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};
