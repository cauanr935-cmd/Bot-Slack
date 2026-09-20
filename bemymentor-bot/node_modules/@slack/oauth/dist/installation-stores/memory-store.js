"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Default Install Store. Should only be used for development
class MemoryInstallationStore {
    devDB = {};
    async storeInstallation(installation, logger) {
        // NOTE: installations on a single workspace that happen to be within an enterprise organization are stored by
        // the team ID as the key
        // TODO: what about installations on an enterprise (acting as a single workspace) with `admin` scope, which is not
        // an org install?
        if (logger !== undefined) {
            logger.warn('Storing Access Token. Please use a real Installation Store for production!');
        }
        if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
            if (logger !== undefined) {
                logger.debug('storing org installation');
            }
            this.devDB[installation.enterprise.id] = installation;
        }
        else if (!installation.isEnterpriseInstall && installation.team !== undefined) {
            if (logger !== undefined) {
                logger.debug('storing single team installation');
            }
            this.devDB[installation.team.id] = installation;
        }
        else {
            throw new Error('Failed saving installation data to installationStore');
        }
    }
    async fetchInstallation(query, logger) {
        if (logger !== undefined) {
            logger.warn('Retrieving Access Token from DB. Please use a real Installation Store for production!');
        }
        if (query.isEnterpriseInstall) {
            if (query.enterpriseId !== undefined) {
                if (logger !== undefined) {
                    logger.debug('fetching org installation');
                }
                return this.devDB[query.enterpriseId];
            }
        }
        if (query.teamId !== undefined) {
            if (logger !== undefined) {
                logger.debug('fetching single team installation');
            }
            return this.devDB[query.teamId];
        }
        throw new Error('Failed fetching installation');
    }
    async deleteInstallation(query, logger) {
        if (logger !== undefined) {
            logger.warn('Deleting Access Token from DB. Please use a real Installation Store for production!');
        }
        if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
            if (logger !== undefined) {
                logger.debug('deleting org installation');
            }
            // Separate out installation from rest of database
            const { [query.enterpriseId]: _, ...devDB } = this.devDB;
            this.devDB = devDB;
        }
        else if (query.teamId !== undefined) {
            if (logger !== undefined) {
                logger.debug('deleting single team installation');
            }
            // Separate out installation from rest of database
            const { [query.teamId]: _, ...devDB } = this.devDB;
            this.devDB = devDB;
        }
        else {
            throw new Error('Failed to delete installation');
        }
    }
}
exports.default = MemoryInstallationStore;
//# sourceMappingURL=memory-store.js.map