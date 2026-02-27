
export interface UserConfig {
    username: string;
    password?: string;
    roles: ('admin' | 'moderator' | 'public')[];
}

export default () => {
    const usersRaw = process.env.USERS || '';
    const usersList = usersRaw.split(',').map((u) => u.trim()).filter((u) => u.length > 0);

    const users: UserConfig[] = usersList.map((username) => {
        let roles: ('admin' | 'moderator' | 'public')[] = ['moderator'];

        // Role assignment logic based on conventions from prompt
        if (username.toUpperCase() === 'ADMIN') {
            roles = ['admin'];
        } else if (username.toUpperCase() === 'INVITADO') {
            roles = ['public'];
        }

        return {
            username,
            password: process.env[`USER_${username}`],
            roles,
        };
    });

    return {
        port: parseInt(process.env.PORT || '3000', 10),
        storagePath: process.env.STORAGE_PATH || './public_storage',
        totalStorageGb: parseInt(process.env.TOTAL_STORAGE_GB || '500', 10),
        adminEmail: process.env.ADMIN_EMAIL,
        users,
    };
};
