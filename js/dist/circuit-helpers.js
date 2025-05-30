var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { pki } from "node-forge";
import circuit from "./assets/circuit-0.1.0.json";
import { verifySignature } from "@anon-aadhaar/react";
import { convertBigIntToByteArray, decompressByteArray, hash, } from "@anon-aadhaar/core";
import * as NoirBignum from "@mach-34/noir-bignum-paramgen";
export function getPublicKeyModulusFromCertificate(certificate) {
    return __awaiter(this, void 0, void 0, function* () {
        const RSAPublicKey = pki.certificateFromPem(certificate).publicKey;
        const publicKey = RSAPublicKey.n.toString(16);
        const pubKeyBigInt = BigInt("0x" + publicKey);
        return pubKeyBigInt;
    });
}
export function generateCircuitInputs(aadhaarQRData, options) {
    return __awaiter(this, void 0, void 0, function* () {
        // Verify locally
        const { certificate } = yield verifySignature(aadhaarQRData, options.useTestingKey);
        const pubKey = yield getPublicKeyModulusFromCertificate(certificate);
        const compressedBytes = convertBigIntToByteArray(BigInt(aadhaarQRData));
        const qrDataBytes = decompressByteArray(compressedBytes);
        const signedData = qrDataBytes.slice(0, qrDataBytes.length - 256);
        const signedDataPadded = new Uint8Array(1200);
        signedDataPadded.set(signedData);
        const signatureBytes = qrDataBytes.slice(qrDataBytes.length - 256, qrDataBytes.length);
        const signatureHex = signatureBytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        const signatureBigInt = BigInt('0x' + signatureHex);
        const signatureLimbs = NoirBignum.bnToLimbStrArray(signatureBigInt);
        const pubkeyModulusLimbs = NoirBignum.bnToLimbStrArray(pubKey);
        const redcLimbs = NoirBignum.bnToRedcLimbStrArray(pubKey);
        const delimiterIndices = [];
        for (let i = 0; i < signedDataPadded.length; i++) {
            if (signedDataPadded[i] === 255) {
                delimiterIndices.push(i);
            }
            if (delimiterIndices.length === 18) {
                break;
            }
        }
        const input = {
            qrDataPadded: {
                len: signedData.length,
                storage: Array.from(signedDataPadded).map(e => e.toString()),
            },
            qrDataPaddedLength: signedData.length.toString(),
            nullifierSeed: options.nullifierSeed.toString(),
            delimiterIndices: delimiterIndices.map((e) => e.toString()),
            signature_limbs: signatureLimbs,
            modulus_limbs: pubkeyModulusLimbs,
            redc_limbs: redcLimbs,
            revealGender: options.revealGender ? "1" : "0",
            revealAgeAbove18: options.revealAgeAbove18 ? "1" : "0",
            revealPinCode: options.revealPinCode ? "1" : "0",
            revealState: options.revealState ? "1" : "0",
            signalHash: hash(options.signal),
        };
        return input;
    });
}
export function generateProof(qrData, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const input = yield generateCircuitInputs(qrData, options);
        console.log("Generated inputs", input);
        const noir = new Noir(circuit);
        const backend = new UltraHonkBackend(circuit.bytecode, { threads: 8 });
        const startTime = performance.now();
        const { witness } = yield noir.execute(input);
        const proof = yield backend.generateProof(witness);
        const provingTime = performance.now() - startTime;
        return { proof: proof.proof, publicInputs: proof.publicInputs, provingTime };
    });
}
export function verifyProof(proof) {
    return __awaiter(this, void 0, void 0, function* () {
        const backend = new UltraHonkBackend(circuit.bytecode, { threads: 8 });
        const verified = yield backend.verifyProof(proof);
        return verified;
    });
}
//# sourceMappingURL=circuit-helpers.js.map