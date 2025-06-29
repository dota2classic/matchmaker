/* tslint:disable */
/* eslint-disable */
/**
 * GameServer api
 * Matches, players, mmrs
 *
 * The version of the OpenAPI document: 1.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { GameserverBanStatusDto, GameserverBanStatusDtoFromJSON, GameserverBanStatusDtoToJSON } from "./";

/**
 *
 * @export
 * @interface GameserverSmurfData
 */
export class GameserverSmurfData {
    /**
     *
     * @type {Array<GameserverBanStatusDto>}
     * @memberof GameserverSmurfData
     */
    relatedBans: Array<GameserverBanStatusDto>;
}

export function GameserverSmurfDataFromJSON(json: any): GameserverSmurfData {
    return GameserverSmurfDataFromJSONTyped(json, false);
}

export function GameserverSmurfDataFromJSONTyped(json: any, ignoreDiscriminator: boolean): GameserverSmurfData {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {

        'relatedBans': ((json['relatedBans'] as Array<any>).map(GameserverBanStatusDtoFromJSON)),
    };
}

export function GameserverSmurfDataToJSON(value?: GameserverSmurfData | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {

        'relatedBans': ((value.relatedBans as Array<any>).map(GameserverBanStatusDtoToJSON)),
    };
}


