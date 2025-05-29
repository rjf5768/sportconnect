export const APP_ID = 'sportconnect';

export const postsCol   = () => `/artifacts/${APP_ID}/public/data/posts`;
export const postDoc    = (id: string) => `${postsCol()}/${id}`;
export const commentsCol = (postId: string) => `${postDoc(postId)}/comments`;
export const usersCol   = () => `/artifacts/${APP_ID}/public/data/users`;
export const userDoc    = (uid: string) => `${usersCol()}/${uid}`;
